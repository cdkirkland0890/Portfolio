import { mkdir, chmod, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export async function openDatabase(filename) {
  const resolved = resolve(filename);
  if (filename !== ":memory:") await mkdir(dirname(resolved), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename === ":memory:" ? filename : resolved);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  const migrations = [
    ["001_initial", "001_initial.sql"],
    ["002_application_children", "002_application_children.sql"],
    ["003_application_battery", "003_application_battery.sql"],
    ["004_child_wish_list_items", "004_child_wish_list_items.sql"],
    ["005_child_sensory_allergy_concerns", "005_child_sensory_allergy_concerns.sql"],
    ["006_child_clothing_sizes", "006_child_clothing_sizes.sql"],
  ];
  for (const [version, filename] of migrations) {
    if (db.prepare("SELECT version FROM schema_migrations WHERE version = ?").get(version)) continue;
    const sql = await readFile(resolve(import.meta.dirname, "migrations", filename), "utf8");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(version, new Date().toISOString());
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      db.close();
      throw error;
    }
  }
  if (filename !== ":memory:") {
    try { await chmod(resolved, 0o600); } catch { /* Windows ACLs are managed by the host. */ }
    try { await chmod(`${resolved}-wal`, 0o600); } catch { /* The WAL file may not exist yet. */ }
  }
  return db;
}

export function audit(db, actor, eventType, applicationId = null, at = new Date().toISOString()) {
  db.prepare("INSERT INTO audit_events (actor, event_type, application_id, created_at) VALUES (?, ?, ?, ?)")
    .run(actor, eventType, applicationId, at);
}

export function saveApplication(db, application) {
  const firstChild = application.children[0];
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`
      INSERT INTO applications (id, name, email, battery, age_band, gender, interests, consent_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      application.id, application.name, application.email, application.battery, firstChild.ageBand,
      firstChild.gender, firstChild.interests, application.consentAt,
      application.createdAt, application.updatedAt,
    );
    const insertChild = db.prepare(`
      INSERT INTO application_children (
        application_id, age_band, gender, interests,
        wish_list_item_1, wish_list_item_2, wish_list_item_3, wish_list_item_4,
        sensory_allergy_concerns, shirt_size, pants_size, shoe_size
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const child of application.children) {
      insertChild.run(
        application.id, child.ageBand, child.gender, child.interests,
        ...child.wishListItems,
        child.sensoryAllergyConcerns, child.shirtSize, child.pantsSize, child.shoeSize,
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function listApplications(db) {
  const applications = db.prepare(`
    SELECT id, name, email, battery, age_band AS ageBand, gender, interests, status,
      created_at AS createdAt, updated_at AS updatedAt
    FROM applications ORDER BY created_at DESC
  `).all();
  return withChildren(db, applications);
}

export function getApplication(db, id) {
  const application = db.prepare(`
    SELECT id, name, email, battery, age_band AS ageBand, gender, interests, status,
      created_at AS createdAt, updated_at AS updatedAt
    FROM applications WHERE id = ?
  `).get(id);
  return application ? withChildren(db, [application])[0] : undefined;
}

function withChildren(db, applications) {
  const children = db.prepare(`
    SELECT age_band AS ageBand, gender, interests,
      wish_list_item_1 AS wishListItem1,
      wish_list_item_2 AS wishListItem2,
      wish_list_item_3 AS wishListItem3,
      wish_list_item_4 AS wishListItem4,
      sensory_allergy_concerns AS sensoryAllergyConcerns,
      shirt_size AS shirtSize,
      pants_size AS pantsSize,
      shoe_size AS shoeSize
    FROM application_children WHERE application_id = ?
  `);
  return applications.map((application) => ({
    ...application,
    children: children.all(application.id).map((child) => ({
      ageBand: child.ageBand,
      gender: child.gender,
      interests: child.interests,
      wishListItems: [child.wishListItem1, child.wishListItem2, child.wishListItem3, child.wishListItem4],
      sensoryAllergyConcerns: child.sensoryAllergyConcerns,
      shirtSize: child.shirtSize,
      pantsSize: child.pantsSize,
      shoeSize: child.shoeSize,
    })),
  }));
}

export function setApplicationStatus(db, id, status, updatedAt) {
  const result = db.prepare("UPDATE applications SET status = ?, updated_at = ? WHERE id = ?")
    .run(status, updatedAt, id);
  return Number(result.changes) === 1;
}

export function getAuditEvents(db, limit = 100) {
  return db.prepare(`
    SELECT actor, event_type AS eventType, application_id AS applicationId, created_at AS createdAt
    FROM audit_events ORDER BY id DESC LIMIT ?
  `).all(limit);
}

export function purgeExpiredApplications(db, retentionDays, now = new Date()) {
  const cutoff = new Date(now.getTime() - retentionDays * 86_400_000).toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    const expired = db.prepare("SELECT id FROM applications WHERE created_at < ?").all(cutoff);
    if (expired.length) {
      const clearAuditReferences = db.prepare("UPDATE audit_events SET application_id = NULL WHERE application_id = ?");
      const removeApplication = db.prepare("DELETE FROM applications WHERE id = ?");
      for (const application of expired) {
        clearAuditReferences.run(application.id);
        removeApplication.run(application.id);
      }
      audit(db, "system", "applications.expired", null, now.toISOString());
    }
    db.exec("COMMIT");
    return expired.length;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
