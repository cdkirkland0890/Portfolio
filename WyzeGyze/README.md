# Wyze Guyz Tattoo Parlor

## Run the local review site

Install Node.js 18 or later, then run these commands from this project folder:

```sh
npm start
```

Open <http://127.0.0.1:3000>. Submit a test review from the "Leave a Review" page; saved reviews and optional photos will then appear under Customer Reviews on the homepage.

Run the local API checks with:

```sh
npm test
```

Reviews are stored in the local `data` folder, which is excluded from Git. This server binds only to `127.0.0.1`; it is for local development and is not reachable from the public site or other devices. Do not deploy it as-is. Public submissions require a hosted endpoint, secure storage, and production moderation/abuse protections.


Need to add cloud or image storage for portfolio uploads
Attach shopifly (or like item) to merchandise page
Add admin login to manage review approvals / merchandise management / portfolio up loads