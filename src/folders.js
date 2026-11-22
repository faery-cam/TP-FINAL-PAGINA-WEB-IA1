const path = require('path');
const uploads = path.join(__dirname, '../public/uploads');

module.exports = {
    folderObras: path.join(uploads, 'obras'),
    folderAvatares: path.join(uploads, 'profileAvatar')
};