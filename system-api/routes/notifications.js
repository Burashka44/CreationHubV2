const { stub } = require('../lib/stub');
module.exports = stub(__filename.split('/').pop().replace('.js',''));
