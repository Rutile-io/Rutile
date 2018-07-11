import { getCommandoClassString } from "./executerLib/Commando";

export interface ExecuteSecureResult {
    type: 'success' | 'error';
    [key: string]: any;
}

function createSecureIframe(): HTMLIFrameElement {
    const secureEvalIframe: HTMLIFrameElement = document.createElement('iframe');

    secureEvalIframe.setAttribute('sandbox', 'allow-scripts');
    secureEvalIframe.setAttribute('style', 'display: none');

    return secureEvalIframe;
}

function getIframeContents(): string {
    // This part of the code is run isolated.
    // We cannot access any variables outside this function.
    function code() {

        // Another sub code that the worker will execute.
        function workerCode() {
            onmessage = (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type !== 'code') {
                        return;
                    }

                    eval(data.value);
                } catch (error) {
                    console.error('And error occured while executing on the worker', error);
                    postMessage({
                        type: 'error',
                        error: error.toString(),
                    }, '*');
                }
            };
        }

        window.addEventListener('message', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type !== 'code') {
                    return;
                }

                const blob = new Blob([`(${workerCode})();`], { type: 'application/javascript' });
                const objectUrl = URL.createObjectURL(blob);
                const evalWorker = new Worker(objectUrl);

                evalWorker.postMessage(event.data);

                evalWorker.addEventListener('message', (event) => {
                    try {
                        const workerMessage = JSON.parse(event.data);

                        if (workerMessage.type === 'success') {
                            window.parent.postMessage(event.data, '*');
                        }
                    } catch (error) {
                        console.error('Message from worker threw an error: ', error);
                    }
                });

            } catch (error) {
                console.error('Message from iframe threw an error: ', error);
            }
        });
    }

    return `<script>(${code})();</script>`;
}

export function executeSecure(code: string, timeLimit: number = 10000) : Promise<ExecuteSecureResult> {
    return new Promise((resolve, reject) => {
        const secureIframe = createSecureIframe();

        // Put in the code once the iframe is loaded.
        secureIframe.addEventListener('load', () => {
            if (!secureIframe.contentWindow) {
                console.error('Could not reach contentWindow..');
                return;
            }

            secureIframe.contentWindow.postMessage(JSON.stringify({
                type: 'code',
                value: `${code}(${getCommandoClassString()}())`,
            }), '*');
        });

        window.addEventListener('message', (event: MessageEvent) => {
            try {
                const messageData = JSON.parse(event.data);

                if (messageData.type === 'success') {
                    resolve({
                        type: 'success',
                        ...messageData
                    });
                }
            } catch (error) {
                console.error(error);
            }
        });

        secureIframe.src = `data:text/html;base64,${btoa(getIframeContents())}`;
        document.body.appendChild(secureIframe);
    });
}
