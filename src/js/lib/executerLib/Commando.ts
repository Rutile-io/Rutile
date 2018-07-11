export interface ICommando {
    done: (result: any) => void;
    error: (error: any) => void;
}

export function getCommandoClassString() {
    function Commando() {
        return {
            done: function (result: any) {
                console.log(result, postMessage);

                const messageValue = JSON.stringify({
                    type: 'success',
                    value: result,
                });

                console.log(messageValue);

                self.postMessage(messageValue, '*');
            },

            error: function (error: any) {
                postMessage(JSON.stringify({
                    type: 'error',
                    value: error,
                }), '*');
            }
        }
    }

    return Commando.toString();
}
