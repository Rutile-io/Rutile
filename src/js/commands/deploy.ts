import Lamda from '../Lamda';
const fs = require('fs');


export default async function deploy(fileLocation: string) {
    return new Promise((resolve, reject) => {
        fs.readFile(fileLocation, (error: any, data: Buffer) => {
            if (error) {
                return reject(error);
            }

            const code = data.toString('utf8');
            const lamda = new Lamda();

            lamda.setCodeString(code);
            lamda.execute();
        });
    });
}