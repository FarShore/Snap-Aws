'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.uploadToAws = uploadToAws;
exports.s3Signature = s3Signature;

var _awsSdk = require('aws-sdk');

var _awsSdk2 = _interopRequireDefault(_awsSdk);

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var AWS_S3_FILES_BUCKET = process.env.AWS_S3_FILES_BUCKET;
var AWS_S3_FILES_KEY_PREFIX = process.env.AWS_S3_FILES_KEY_PREFIX;
var AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
var AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
var AWS_S3_VIDEO_OVERSIZED_PREFIX = process.env.AWS_S3_VIDEO_OVERSIZED_PREFIX;
var AWS_REGION = process.env.AWS_REGION;
function uploadToAws(req, res, next) {
  var file = req.file;

  // Clean the file name of special characters, extra spaces, etc.
  var fileName = file.originalname.replace(/[^a-zA-Z0-9. ]/g, '').replace(/\s+/g, ' ').replace(/[ ]/g, '-');

  // Check if the fileName has a file extension
  // If it doesn't we add a fileExt from the mimetype
  var pattern = /\.[0-9a-z]+$/i;
  var foundFileExt = fileName.match(pattern);
  if (!foundFileExt) {
    // Get the file extension from the mimetype
    var fileExt = file.mimetype.substr(file.mimetype.indexOf('/') + 1);

    // Add to the fileName
    fileName += '.' + fileExt;
  }

  // Create random string to ensure unique filenames
  var randomBytes = _crypto2.default.randomBytes(32).toString('hex');

  /**
   * Create aws file key by combining random string and file name
   * e.g., 73557ec94ea744c5c24bdb03ee114a1ef83ab2dd9bfb20f38999faea14564d19/DarthVader.jpg
   */
  var fileKey = AWS_S3_FILES_KEY_PREFIX + '/' + randomBytes + '/' + fileName;

  // Configure aws
  _awsSdk2.default.config.accessKeyId = AWS_ACCESS_KEY_ID;
  _awsSdk2.default.config.secretAccessKey = AWS_SECRET_ACCESS_KEY;

  // Create our bucket and set params
  var bucket = new _awsSdk2.default.S3({
    params: { Bucket: AWS_S3_FILES_BUCKET }
  });

  var params = {
    Key: fileKey,
    Body: _fs2.default.createReadStream(file.path),
    Bucket: AWS_S3_FILES_BUCKET,
    ContentType: file.mimetype != '' ? file.mimetype : 'application/octet-stream'
  };

  // Upload file to s3
  bucket.upload(params, function (err, data) {
    if (data) {
      // Delete the file once it's been uploaded to s3
      _fs2.default.unlinkSync(file.path);

      var fileObject = {
        name: fileName,
        type: file.mimetype,
        size: file.size,
        url: fileKey
      };

      res.status(200).json(fileObject);
    } else {
      // Delete the file
      _fs2.default.unlinkSync(file.path);
      res.status(403).json(err);
    }
  });
}

function s3Signature(req, res, next) {
  if (!req.query.fileType || !req.query.fileName) {
    return res.status(422).json({ error: 'Missing required parameters' });
  }

  var s3 = new _awsSdk2.default.S3({ region: AWS_REGION });
  _awsSdk2.default.config.update({ accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY });

  var fileType = req.query.fileType;

  // Clean the file name of special characters, extra spaces, etc.
  var fileName = req.query.fileName;

  // Create random string to ensure unique filenames
  var randomBytes = _crypto2.default.randomBytes(32).toString('hex');
  var wholeFilePath = void 0;
  // we want to make sure the file is a mp4 so we can transcode it
  if (fileType === 'video/mp4') {
    wholeFilePath = AWS_S3_VIDEO_OVERSIZED_PREFIX + '/' + randomBytes + '/' + fileName;
  } else {
    wholeFilePath = AWS_S3_FILES_KEY_PREFIX + '/' + randomBytes + '/' + fileName;
  }

  var s3Params = {
    Bucket: AWS_S3_FILES_BUCKET,
    Key: wholeFilePath,
    Expires: 60,
    ContentType: fileType,
    ACL: 'public-read'
  };
  s3.getSignedUrl('putObject', s3Params, function (err, data) {
    if (err) {
      console.log(err);
      return res.end();
    }

    var returnData = {
      s3Signature: data,
      url: wholeFilePath
    };

    res.status(200).json(returnData);
  });
};