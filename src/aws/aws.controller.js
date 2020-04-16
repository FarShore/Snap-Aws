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
    res.status(200).json(file);
   
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
