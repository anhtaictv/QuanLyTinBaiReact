const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET;

exports.verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: "Không tìm thấy Token!" });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(401).json({ message: "Token đã hết hạn hoặc không hợp lệ!" });
        req.user = user;
        next();
    });
};

exports.isAdmin = (req, res, next) => {
    // Check role không phân biệt hoa thường
    const userRole = (req.user.Role || req.user.role || '');
    if (userRole.toLowerCase() !== 'admin') {
        return res.status(403).json({ message: "Chỉ Admin mới có quyền thực hiện!" });
    }
    next();
};