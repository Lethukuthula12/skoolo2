import { bootstrapApplication } from '@angular/platform-browser';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline, arrowBackOutline, callOutline, cameraOutline, checkmarkCircleOutline,
  chevronDownOutline, chevronUpOutline, closeCircleOutline, cloudUploadOutline, copyOutline,
  documentTextOutline, globeOutline, locationOutline, logOutOutline, mailOpenOutline, mailOutline,
  personCircleOutline, schoolOutline, searchOutline, timeOutline, walletOutline,
  busOutline, folderOpenOutline, homeOutline, receiptOutline, refreshOutline, trashOutline, openOutline,
  phonePortraitOutline, shareOutline, peopleOutline, sendOutline, chevronForwardOutline,
  calendarOutline, notificationsOutline, pin, checkboxOutline,
} from 'ionicons/icons';
import { appConfig } from './app/app.config';
import { App } from './app/app';

addIcons({
  alertCircleOutline, arrowBackOutline, callOutline, cameraOutline, checkmarkCircleOutline,
  chevronDownOutline, chevronUpOutline, closeCircleOutline, cloudUploadOutline, copyOutline,
  documentTextOutline, globeOutline, locationOutline, logOutOutline, mailOpenOutline, mailOutline,
  personCircleOutline, schoolOutline, searchOutline, timeOutline, walletOutline,
  busOutline, folderOpenOutline, homeOutline, receiptOutline, refreshOutline, trashOutline, openOutline,
  phonePortraitOutline, shareOutline, peopleOutline, sendOutline, chevronForwardOutline,
  calendarOutline, notificationsOutline, pin, checkboxOutline,
});

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
