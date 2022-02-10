import fs from 'fs';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween.js';
dayjs.extend(isBetween);

const sourcePath = 'token.txt'

function editEnvFile(newToken) {
  if (newToken) {
    fs.writeFileSync('./token.txt', newToken)
  }
}

function getToken() {
  let fileContent = fs.readFileSync(sourcePath, "utf8");

  return fileContent;
}

function findRes(res) {
  let currentWorkers = [];

  if (res?.items?.length > 0) {
    for (let i = 0; i < res.items.length; i++) {
      try {
        if (dayjs().isBetween(dayjs(res.items[i]?.start?.dateTime), dayjs(res.items[i]?.end?.dateTime))) {
          currentWorkers.push(res.items[i].summary);
        }
      } catch (e) {
        console.log(e);
      }
    }
  }

  return currentWorkers;
}


export {editEnvFile, findRes, getToken};