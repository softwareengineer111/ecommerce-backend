
# Ecommerce Backend (Node.js + Express + MongoDB)

## Features
- JWT Authentication (register / login)
- Mongoose models: User, Product, Order
- Protected routes with middleware
- Basic CRUD for products, create orders

## Setup
1. `npm install`
2. Create a `.env` file with:
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/ecom
JWT_SECRET=change_this_secret
```
3. `npm run dev` (requires nodemon) or `npm start`

This is a starter scaffold — extend as needed.
