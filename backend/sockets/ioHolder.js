// Cho phép REST controller (không có quyền truy cập trực tiếp vào `io`) phát
// socket event sau khi thao tác DB xong (vd: có file đính kèm mới upload qua REST).
let ioInstance = null;

function setIO(io) {
    ioInstance = io;
}

function getIO() {
    return ioInstance;
}

module.exports = { setIO, getIO };
