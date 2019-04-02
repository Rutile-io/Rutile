import { workerAddEventListener } from "./utils/workerUtils";

function onMessage(event: any) {
    console.log('[] event -> ', event);
}

workerAddEventListener('message', onMessage);
// self.addEventListener('message', onMessage);
