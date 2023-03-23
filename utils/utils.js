import fs from 'fs';
import * as envfile from 'envfile';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import localeData from 'dayjs/plugin/localeData.js';
import 'dayjs/locale/ru.js';

dayjs.extend(localeData)
dayjs.locale('ru') // use locale globally
dayjs().locale('ru').format() // use locale in a specific instance

dayjs.extend(customParseFormat);
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

function returnWorkersFromDate(date, data) {
  const nextDay = date.set('day', date.day() + 1).set('hour', 2).set('minute', 59).set('second', 59);
  date = date.set('hour', 3).set('minute', 0).set('second', 0);
  let compatibleWorkers = [];
  let resString = '';

  if (data?.items?.length > 0) {
    for (let i = 0; i < data.items.length; i++) {
      try {
        if (dayjs(data.items[i]?.start?.dateTime).isBetween(date, nextDay) || dayjs(data.items[i]?.end?.dateTime).isBetween(date, nextDay)) {
          compatibleWorkers.push({ name: data.items[i].summary, start: data.items[i]?.start?.dateTime,end: data.items[i]?.end?.dateTime });
        }
      } catch (e) {
        console.log(e);
      }
    }
  }

  if (compatibleWorkers.length == 0) {
    resString = 'Ничего не найдено.'
  } else {
    for (let i = 0; i < compatibleWorkers.length; i++) {
      resString += `${dayjs(compatibleWorkers[i].start).format('DD.MM HH:mm')} - ${dayjs(compatibleWorkers[i].end).format('DD.MM HH:mm')}   ${compatibleWorkers[i].name}\n`;
    }

    resString = `${dayjs(date).format('DD.MM.YY')} в смене:\n\n${resString}`;
  }

  return resString;
}

function joinWorkersOnTheSameDate(resArr) {
  let newArr = [];
  let temp = [];
  resArr.map((item, index, array) => {
      if (temp.length > 0 && (item.substr(0,22) == temp[0].substr(0,22))) {
          temp.push(item);
      } else {
          temp.map((item, index, array) => {
              if (index != 0) {
                  array[index] = array[index].slice(22, array[index].length).trim();
              }
          });

          if (temp.length > 0) newArr.push(temp.join(', ') + '\n');

          temp = [item];
      }

      if (index == resArr.length - 1) {
          temp.map((item, index, array) => {
              if (index != 0) {
                  array[index] = array[index].slice(22, array[index].length).trim();
              }
          });

          newArr.push(temp.join(', ') + '\n');
      }
  });

  return newArr;
}

// формирует сообщение для отправки
function formMessage(resArr) {
  let resStringsArr = [];
  let resString = '';
  let amountOfSymbs = 0;
  let newArr = joinWorkersOnTheSameDate(resArr);
  const MAX_SYMBS = 4096;

  if (newArr.join('').length < 4096) {
    for (let i = 0; i < newArr.length; i++) {
      resString += newArr[i];
    }
    resStringsArr.push(resString);
  } else {
    for (let i = 0; i < newArr.length; i++) {
      amountOfSymbs += newArr[i].length;

      if (amountOfSymbs >= MAX_SYMBS) {
        resStringsArr.push(resString);
        resString = newArr[i];
        amountOfSymbs = newArr[i].length;
      } else {
        resString += newArr[i];
      }
    }
  }

  return resStringsArr;
}

// возвращает события из определенного промежутка времени
function returnWorkersInSelectedDate(data) {
  const sortedEvents = sortEvents(data);
  let resArr = [];
  for (let i = 0; i < sortedEvents.length; i++) {
    resArr.push(`${dayjs(sortedEvents[i]?.start?.dateTime).format('DD.MM.YYYY HH:mm')}-${dayjs(sortedEvents[i]?.end?.dateTime).format('HH:mm')}   ${sortedEvents[i].summary}`);
    //console.log(`${dayjs(sortedEvents[i]?.start?.dateTime).format('DD.MM HH:mm')} - ${dayjs(sortedEvents[i]?.end?.dateTime).format('DD.MM HH:mm')}   ${sortedEvents[i].summary}`);
  }

  return formMessage(resArr);
}

// === work with data ===
function convertFromJson(data) {
  return JSON.parse(data);
}

function saveJson(data, isTable) {
  fs.writeFileSync(isTable ? "./data/usersfortable.json" : "./data/users.json", JSON.stringify(data));
}

function readWorkersFromJson() {
  const workersData = fs.readFileSync("./data/workers.json", "utf8");

  return convertFromJson(workersData);
}

function readUsersQueueFromJson(isTable) {
  const usersData = fs.readFileSync(isTable ? "./data/usersfortable.json" : "./data/users.json", "utf8");

  return convertFromJson(usersData);
}

function addUser(user, isTable) {
  const usersData = readUsersQueueFromJson(isTable);

  usersData.push(user);

  saveJson(usersData, isTable);
}

function deleteUser(chatId, isTable) {
  const usersData = readUsersQueueFromJson(isTable);
  let usersDataEdited = [];

  for (let i = 0; i < usersData.length; i++) {
    if (usersData[i].chatId != chatId) {
      usersDataEdited.push(usersData[i]);
    }
  }

  saveJson(usersDataEdited, isTable);
}


export {editEnvFile, getToken, returnRes, readWorkersFromJson, readUsersQueueFromJson, addUser, deleteUser, returnWorkersFromDate, returnWorkersInSelectedDate};