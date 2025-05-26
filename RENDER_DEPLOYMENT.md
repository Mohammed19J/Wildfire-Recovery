# Render Deployment Instructions

## Backend (Express API)

1. Go to https://dashboard.render.com and create a new Web Service.
2. Connect your GitHub repo and select the `backend/` folder as the root.
3. Set the build command to `npm install` (or leave blank if not needed).
4. Set the start command to `npm start`.
5. Add any environment variables you need.

## Frontend (React)

1. Create a new Static Site on Render.
2. Select the `frontend/` folder as the root.
3. Set the build command to `npm install && npm run build`.
4. Set the publish directory to `build`.
5. The included `static.json` ensures SPA routing works.

## Connecting Frontend to Backend

- In production, update your frontend API URLs to use the Render backend service URL (not `/api/...`).
- You can use an environment variable (e.g., `REACT_APP_API_URL`) in your React app for this purpose.

## CORS

- Make sure your Express backend allows CORS from your frontend domain.

---

For more details, see: https://render.com/docs/deploy-node-express-app and https://render.com/docs/static-sites
