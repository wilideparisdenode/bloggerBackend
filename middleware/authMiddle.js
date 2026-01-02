import jwt from "jsonwebtoken";

import  User from  "../models/user.js";
import  AsyncHandle from  "express-async-handler";

export const protect = AsyncHandle(async (req, res, next) => {
    let token;
    if (req.headers.authorization &&             req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.SECRET_KEY);
            const user = await User.findOne({ _id: decoded.id });
            console.log(token);
            if (!user) {
                return res.status(401).send("Not authorized, user not found");
            }
            req.user = user;
            next();
        } catch (err) {
            console.log(err.message);
            res.status(401).send("Not authorized, token failed");
        }
    } else {
        res.status(401).send("Not authorized, no token");
    }
});

// Admin middleware
export  const isAdmin = (req, res, next) => {
    if (req.user && req.user.isAdmin) {
        next();
    } else {
        res.status(403).send("Not authorized as admin");
    }
};

