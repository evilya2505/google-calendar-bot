import fs from 'fs';
import * as envfile from 'envfile';
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

function returnRes(res) {
  const sortedRes = sortEvents(res);
  const currentWorkersObjs = findCurrentWorkers(sortedRes);
  const nextWorkers = findNextRes(sortedRes, currentWorkersObjs[currentWorkersObjs.length - 1]);
  let currentWorkersNames = [];

  for (let i = 0; i < currentWorkersObjs.length; i++) {
    currentWorkersNames.push(currentWorkersObjs[i].summary);
  }

  return {currentWorkers: currentWorkersNames, nextWorkers: nextWorkers};
}

function findCurrentWorkers(res) {
  let currentWorkers = [];

  if (res?.length > 0) {
    for (let i = 0; i < res.length; i++) {
      try {
        if (dayjs().isBetween(dayjs(res[i]?.start?.dateTime), dayjs(res[i]?.end?.dateTime))) {
          currentWorkers.push(res[i]);
        }
      } catch (e) {
        console.log(e);
      }
    }
  }

  return currentWorkers;
}

// следующее событие
function findNextRes(res, currentEvent) {
  let sortedRes = res;
  let nextWorkers = [];
  let currentId;

  // находит и присваивает переменной currentId Id последнего текущего сотрудника
  for (let i = 0; i < sortedRes.length; i++) {
    if (currentEvent?.start.dateTime == sortedRes[i]?.start.dateTime) {
      currentId = i;
    }
  }

  sortedRes.splice(0, currentId+1);
  let editedSortedRes = sortedRes;

  // первый элемент editedSortedRes добавляется в массив nextWorkers
  nextWorkers.push(editedSortedRes[0].summary);

  // проходится по массиву editedSortedRes и добавляет все подходящие
  for (let i = 1; i < editedSortedRes.length; i++) {
    if (dayjs(editedSortedRes[i]?.start.dateTime).isSame(dayjs(editedSortedRes[0]?.start.dateTime))) {
      nextWorkers.push(editedSortedRes[i].summary);
    }
  }

  return nextWorkers;
}

// сортировка по дате начала события
function sortEvents(res) {
  if (res?.items?.length > 0) {
    let sortedRes = res.items;

    for (let j = sortedRes.length - 1; j > 0; j--) {
      for (let i = 0; i < j; i++) {
        if (sortedRes[i].start.dateTime > sortedRes[i + 1].start.dateTime) {
          let temp = sortedRes[i];
          sortedRes[i] = sortedRes[i + 1];
          sortedRes[i + 1] = temp;
        }
      }
    }

    return sortedRes;
  } else {
    return [];
  }
}


export {editEnvFile, getToken, returnRes};