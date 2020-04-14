'use strict';

import aws from 'aws-sdk';
import crypto from 'crypto';
import fs from 'fs';

const AWS_S3_FILES_BUCKET = process.env.AWS_S3_FILES_BUCKET;
const AWS_S3_FILES_KEY_PREFIX = process.env.AWS_S3_FILES_KEY_PREFIX;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_S3_VIDEO_OVERSIZED_PREFIX = process.env.AWS_S3_VIDEO_OVERSIZED_PREFIX
const AWS_REGION = process.env.AWS_REGION
export function uploadToAws(req, res, next) {
  let file = req.file;

  // Clean the file name of special characters, extra spaces, etc.
  let fileName = file.originalname
                          .replace(/[^a-zA-Z0-9. ]/g, '')
                          .replace(/\s+/g, ' ')
                          .replace(/[ ]/g, '-');

  // Check if the fileName has a file extension
  // If it doesn't we add a fileExt from the mimetype
  let pattern = /\.[0-9a-z]+$/i;
  let foundFileExt = fileName.match(pattern);
  if (!foundFileExt) {
    // Get the file extension from the mimetype
    let fileExt = file.mimetype.substr(file.mimetype.indexOf('/') + 1);

    // Add to the fileName
    fileName += `.${fileExt}`;
  }

  // Create random string to ensure unique filenames
  let randomBytes = crypto.randomBytes(32).toString('hex');

  /**
   * Create aws file key by combining random string and file name
   * e.g., 73557ec94ea744c5c24bdb03ee114a1ef83ab2dd9bfb20f38999faea14564d19/DarthVader.jpg
   */
  let fileKey = `${AWS_S3_FILES_KEY_PREFIX}/${randomBytes}/${fileName}`;


  // Configure aws
  aws.config.accessKeyId = AWS_ACCESS_KEY_ID;
  aws.config.secretAccessKey = AWS_SECRET_ACCESS_KEY;

  // Create our bucket and set params
  let bucket = new aws.S3({
    params: { Bucket: AWS_S3_FILES_BUCKET }
  });

  let params = {
    ACL: 'public-read',
    Key: fileKey,
    Body: fs.createReadStream(file.path),
    Bucket: AWS_S3_FILES_BUCKET,
    ContentType: file.mimetype != '' ? file.mimetype : 'application/octet-stream'
  };

  // Upload file to s3
  bucket.upload(params, function(err, data) {
    if (data) {
      // Delete the file once it's been uploaded to s3
      fs.unlinkSync(file.path);

      let fileObject = {
        name: fileName,
        type: file.mimetype,
        size: file.size,
        url: fileKey
      };

      res.status(200).json(fileObject);
    } else {
      // Delete the file
      fs.unlinkSync(file.path);
      res.status(403).json(err);
    }
  });
}

export function s3Signature(req, res, next) {
  // Configure aws
  aws.config.accessKeyId = AWS_ACCESS_KEY_ID;
  aws.config.secretAccessKey = AWS_SECRET_ACCESS_KEY;
  if (!req.query.fileType || !req.query.fileName) {
    return res.status(422).json({ error: 'Missing required parameters' });
  }
  const s3 = new aws.S3({ region: AWS_REGION});
  let fileType = req.query.fileType;

  // Clean the file name of special characters, extra spaces, etc.
  let fileName = req.query.fileName

  // Create random string to ensure unique filenames
  let randomBytes = crypto.randomBytes(32).toString('hex');
  let wholeFilePath;
  // we want to make sure the file is a mp4 so we can transcode it
  if(fileType === 'video/mp4'){
    wholeFilePath = `${AWS_S3_VIDEO_OVERSIZED_PREFIX}/${randomBytes}/${fileName}`
  } else {
    wholeFilePath = `${AWS_S3_FILES_KEY_PREFIX}/${randomBytes}/${fileName}`
  }



  const s3Params = {
    Bucket: AWS_S3_FILES_BUCKET,
    Key: wholeFilePath,
    Expires: 60,
    ContentType: fileType,
    ACL: 'public-read'
  };
  s3.getSignedUrl('putObject', s3Params, (err, data) => {
    if(err){
      console.log(err);
      return res.end();
    }

    const returnData = {
      s3Signature: data,
      url: wholeFilePath,
    };

    res.status(200).json(returnData);
  });
};
