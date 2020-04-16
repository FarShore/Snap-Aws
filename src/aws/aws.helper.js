'use strict';

import AWS from 'aws-sdk';
import Promise from 'bluebird';
/**
 * Generate an array of image style objects based on the S3 key (original url)
 * @param  {String} s3Key The original S3 Key
 * @return {Object}        Object of image styles
 */
export function stylesForImage(s3Key) {
  const baseDirectory = 'original';
  const styles = ['large', 'large_square', 'medium', 'medium_square', 'thumb', 'thumb_square'];

  let imageStyles = {};

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
export function validateExistence(s3Key) {
  return new Promise((resolve, reject) => {
    if (!s3Key) {
      reject(new Error('S3 key is required to validate existence of the file.'));
    }

    let params = {
      Bucket: process.env.AWS_S3_FILES_BUCKET,
      Key: s3Key,
    };
    let s3 = new AWS.S3();
    s3.headObject(params, (err, response) => {
      if (err) {
        let errMessage = new Error(`Could not find S3 file ${s3Key}. ` +
                                   `Error '${err.code}' with status '${err.statusCode}'.`);
        console.error(errMessage);
        reject(errMessage);
      }

      console.log(`Confirmed existence for ${s3Key}.`);
      resolve(response);
    });
  });
}

/**
 * Returns a promise of a S3 key file
 * @param  {String} s3Key S3 key of CSV
 * @return {Promise<Response|Error>} Returns the success response of the s3.headObject API call or error
 */
export function getFile(s3Key) {
  return new Promise((resolve, reject) => {
    if (!s3Key) {
      reject(new Error('S3 key is required to get the file.'));
    }

    // Configure aws
    AWS.config.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    AWS.config.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    let params = {
      Bucket: process.env.AWS_S3_FILES_BUCKET,
      Key: s3Key,
    };
    let s3 = new AWS.S3();
    s3.getObject(params, (err, response) => {
      if (err) {
        let errMessage = new Error(`Could not find S3 file ${s3Key}. ` +
                                   `Error '${err.code}' with status '${err.statusCode}'.`);
        console.error(errMessage);
        reject(errMessage);
      }

      console.log(`Found file for ${s3Key}.`);
      resolve(response);
    });
  });
  }

  export function createMediaConvertJob(Settings, model) {
    return new Promise((resolve, reject) => {
    const regex = new RegExp(`${process.env.AWS_S3_VIDEO_OVERSIZED_PREFIX}/`, 'g');
    if (model.video.url.match(regex)) {
      const sourceS3Bucket = process.env.AWS_S3_FILES_BUCKET;
      // location of the video
      const sourceS3Key = model.video.url;
      const region = process.env.AWS_REGION;
      const endpoint = process.env.AWS_ENDPOINT;
      const TRANSCODED_PREFIX = process.env.TRANSCODED_PREFIX
      const sourceS3 = `s3://${sourceS3Bucket}/${sourceS3Key}`;
      const destinationS3Key = `s3://${sourceS3Bucket}/${TRANSCODED_PREFIX}/${sourceS3Key.split('/').reverse()[0].split('.')[0]}${sourceS3Key.split('/').reverse()[1]}`;
  
  
      if (sourceS3Key === destinationS3Key) {
        // we need to log all errors in case this breaks
        // eslint-disable-next-line no-console
        console.log('Source and destination buckets are the same.');
        reject('Source and destination buckets are the same.');
      }
  
      Settings.OutputGroups[0].OutputGroupSettings.HlsGroupSettings.Destination = `${destinationS3Key}/adaptive/${sourceS3Key.split('/').reverse()[0].split('.')[0]}`;
      Settings.OutputGroups[1].OutputGroupSettings.FileGroupSettings.Destination = `${destinationS3Key}/thumbnails`;
      Settings.Inputs[0].FileInput = sourceS3;
      const Role = process.env.MEDIA_CONVERT_ROLE;
      const params = {
        Role,
        Settings,
      };
      const options = {
        region, endpoint, apiVersion: "2017-08-29"
      };
      AWS.config.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
      AWS.config.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  
      const mediaconvert = new AWS.MediaConvert(options);
      mediaconvert.createJob(params, (err, response) => {
        if (err) {
          // we need to log all errors in case this breaks
          // eslint-disable-next-line no-console
          console.log('There was an error in creating a mediaConvert job', err); // an error occurred
          reject(err)
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

