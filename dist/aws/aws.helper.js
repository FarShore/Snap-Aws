'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.stylesForImage = stylesForImage;
exports.validateExistence = validateExistence;
exports.getFile = getFile;
exports.createMediaConvertJob = createMediaConvertJob;

var _awsSdk = require('aws-sdk');

var _awsSdk2 = _interopRequireDefault(_awsSdk);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Generate an array of image style objects based on the S3 key (original url)
 * @param  {String} s3Key The original S3 Key
 * @return {Object}        Object of image styles
 */
function stylesForImage(s3Key) {
  var baseDirectory = 'original';
  var styles = ['large', 'large_square', 'medium', 'medium_square', 'thumb', 'thumb_square'];

  var imageStyles = {};

  for (var i = styles.length - 1; i >= 0; i--) {
    imageStyles[styles[i]] = s3Key.replace(baseDirectory, styles[i]);
  }

  return imageStyles;
}

/**
 * Validates existence of S3 key via AWS API `headObject` method
 * @param  {String} s3Key S3 key to validate
 * @return {Promise<Response|Error>} Returns the success response of the s3.headObject API call or error
 */
function validateExistence(s3Key) {
  return new _bluebird2.default(function (resolve, reject) {
    if (!s3Key) {
      reject(new Error('S3 key is required to validate existence of the file.'));
    }

    var params = {
      Bucket: process.env.AWS_S3_FILES_BUCKET,
      Key: s3Key
    };
    var s3 = new _awsSdk2.default.S3();
    s3.headObject(params, function (err, response) {
      if (err) {
        var errMessage = new Error('Could not find S3 file ' + s3Key + '. ' + ('Error \'' + err.code + '\' with status \'' + err.statusCode + '\'.'));
        console.error(errMessage);
        reject(errMessage);
      }

      console.log('Confirmed existence for ' + s3Key + '.');
      resolve(response);
    });
  });
}

/**
 * Returns a promise of a S3 key file
 * @param  {String} s3Key S3 key of CSV
 * @return {Promise<Response|Error>} Returns the success response of the s3.headObject API call or error
 */
function getFile(s3Key) {
  return new _bluebird2.default(function (resolve, reject) {
    if (!s3Key) {
      reject(new Error('S3 key is required to get the file.'));
    }

    // Configure aws
    _awsSdk2.default.config.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    _awsSdk2.default.config.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    var params = {
      Bucket: process.env.AWS_S3_FILES_BUCKET,
      Key: s3Key
    };
    var s3 = new _awsSdk2.default.S3();
    s3.getObject(params, function (err, response) {
      if (err) {
        var errMessage = new Error('Could not find S3 file ' + s3Key + '. ' + ('Error \'' + err.code + '\' with status \'' + err.statusCode + '\'.'));
        console.error(errMessage);
        reject(errMessage);
      }

      console.log('Found file for ' + s3Key + '.');
      resolve(response);
    });
  });
}

function createMediaConvertJob(Settings, model) {
  return new _bluebird2.default(function (resolve, reject) {
    var regex = new RegExp(process.env.AWS_S3_VIDEO_OVERSIZED_PREFIX + '/', 'g');
    if (model.video.url.match(regex)) {
      var sourceS3Bucket = process.env.AWS_S3_FILES_BUCKET;
      // location of the video
      var sourceS3Key = model.video.url;
      var region = process.env.AWS_REGION;
      var endpoint = process.env.AWS_ENDPOINT;
      var TRANSCODED_PREFIX = process.env.TRANSCODED_PREFIX;
      var sourceS3 = 's3://' + sourceS3Bucket + '/' + sourceS3Key;
      var destinationS3Key = 's3://' + sourceS3Bucket + '/' + TRANSCODED_PREFIX + '/' + sourceS3Key.split('/').reverse()[0].split('.')[0] + sourceS3Key.split('/').reverse()[1];

      if (sourceS3Key === destinationS3Key) {
        // we need to log all errors in case this breaks
        // eslint-disable-next-line no-console
        console.log('Source and destination buckets are the same.');
        reject('Source and destination buckets are the same.');
      }

      Settings.OutputGroups[0].OutputGroupSettings.HlsGroupSettings.Destination = destinationS3Key + '/adaptive/' + sourceS3Key.split('/').reverse()[0].split('.')[0];
      Settings.OutputGroups[1].OutputGroupSettings.FileGroupSettings.Destination = destinationS3Key + '/thumbnails';
      Settings.Inputs[0].FileInput = sourceS3;
      var Role = process.env.MEDIA_CONVERT_ROLE;
      var params = {
        Role: Role,
        Settings: Settings
      };
      var options = {
        region: region, endpoint: endpoint, apiVersion: "2017-08-29"
      };
      _awsSdk2.default.config.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
      _awsSdk2.default.config.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

      var mediaconvert = new _awsSdk2.default.MediaConvert(options);
      mediaconvert.createJob(params, function (err, response) {
        if (err) {
          // we need to log all errors in case this breaks
          // eslint-disable-next-line no-console
          console.log('There was an error in creating a mediaConvert job', err); // an error occurred
          reject(err);
          model.video.status = 'error';
        } else {
          console.log(response);
          // successful response
          model.video.jobId = response.Job.Id;
          resolve('TRANSCODING');
        }
      });
    }
  });
}