const bcrypt = require('bcrypt');
bcrypt.hash('admin123', 10, function(err, hash) {
  console.log(hash);
});
