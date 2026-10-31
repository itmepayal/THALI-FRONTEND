# Thali: Frontend

Thali is a recipe sharing app. Browse home-cooked recipes from other people, save your favourites, and add your own with photos.

This is the **React + Vite** frontend. It talks to the Thali Node.js / Express / MongoDB backend.

## Features

- **Browse recipes** with search by dish name or ingredient
- **Filters and sorting**: under 20 min, under 40 min, favourites, my recipes, newest, quickest, A to Z
- **Recipe details**: tick off ingredients you already have, copy a shopping list of what is missing, share the recipe
- **Favourites** saved in the browser (localStorage)
- **Sign up and log in** with JWT, password strength meter, show/hide password
- **Auto logout** when the token expires or the server rejects it, and sync across browser tabs
- **Add, edit and delete your own recipes**, with an image upload (JPG, PNG, WebP, up to 5 MB)
- **Light and dark theme**, remembered between visits
- **Interactive hero card** where you can change servings and tick ingredients
- **Responsive layout** with a hamburger menu on smaller screens
- **Sample recipes** shown automatically if the backend is empty or not running

## Tech stack

- [React](https://react.dev/)
- [Vite](https://vite.dev/)
- [Axios](https://axios-http.com/)
- Plain CSS (no UI library)

## Getting started

### Prerequisites

- Node.js 18 or newer
- The Thali backend running (see the backend README)

### Install and run

```bash
# install dependencies
npm install

# start the dev server
npm run dev
```

Open the URL shown in the terminal, usually `http://localhost:5173`.

### Other scripts

```bash
npm run build     # production build in /dist
npm run preview   # preview the production build locally
```

## Configuration

The backend URL is set at the top of `src/App.jsx`:

```js
const API = "http://localhost:8000";
```

Change it if your backend runs on a different host or port.

Make sure the backend uses the same port. In the backend `.env`:

```
PORT=8000
```

## Backend API used

| Method | Endpoint      | Auth | Purpose                        |
| ------ | ------------- | ---- | ------------------------------ |
| POST   | `/signUp`     | No   | Create an account              |
| POST   | `/login`      | No   | Log in                         |
| POST   | `/logout`     | Yes  | Log out (token is blacklisted) |
| GET    | `/user/:id`   | Yes  | Check the saved login          |
| GET    | `/recipe`     | No   | List all recipes               |
| POST   | `/recipe`     | Yes  | Add a recipe (multipart form)  |
| PUT    | `/recipe/:id` | Yes  | Edit your own recipe           |
| DELETE | `/recipe/:id` | Yes  | Delete your own recipe         |

Recipe images are loaded from `{API}/images/{coverImage}`.

The full API docs are available from the backend at `/api-docs` (Swagger).

## Project structure

```
src/
  App.jsx      # whole app: navbar, hero, recipes, modals, auth
  App.css      # all styles, including light and dark theme
  main.jsx     # React entry point
```

## How login works

1. After sign up or log in, the token and user are saved in `localStorage`.
2. Axios adds `Authorization: Bearer <token>` to every request.
3. If the server answers 401 (or 403 for an expired token), the app logs the user out and shows a message.
4. A timer logs the user out automatically when the JWT expires.

## Theme

Colours are CSS variables set on `.landing`. Dark mode is applied with `data-theme="dark"` and is saved in `localStorage` under the `theme` key.

## Troubleshooting

- **"Cannot reach the server"**: the backend is not running, or `API` in `App.jsx` points to the wrong port.
- **Sample recipes are showing**: no recipes came back from the backend. Check the backend is running and has data.
- **Images not showing**: check that the backend serves the `public` folder and that `API` is correct.
- **CORS errors**: make sure the backend has `cors()` enabled.

## Author

Made with love by **Kartik Yadav**.
