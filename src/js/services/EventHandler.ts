const noop = () => {};

interface StackItem {
    block: boolean;
    caller: string;
    id: number;
    method: Function;
}

interface EventStack {
    [hook: string]: StackItem[];
}

interface HookInfo {
    id: number;
    hook: string;
}

class EventHandler {
    stack: EventStack = {};
    counter: number = 0;
    disabledHandles: string[] = [];
    protectedHandles: {
        [key: string]: Function;
    };

    /**
     * Listens for the event
     *
     * @param {Array|String} hooks
     * @param {Function} method
     * @param {string} [caller='Anonymous']
     * @returns {Object}
     * @memberof EventHandler
     */
    on(hooks: string|string[], method: Function, caller: string = 'Anonymous'): HookInfo[] {
        // Check whether the method is a function.
        if (!(method instanceof Function)) {
            console.error('EventHandler: Provided handler is not a function.');
            return;
        }

        // Convert hooks to an array to keep flow similar.
        if (!(hooks instanceof Array)) {
            hooks = [hooks];
        }

        // Register the handle on all hooks.
        const newHandles = [];
        for (let i = 0; i < hooks.length; i += 1) {
            let hook = hooks[i];

            if (!this.stack[hook]) {
                this.stack[hook] = [];
            }

            const newHandle = this._createHandler(caller, method);
            this.stack[hook].push(newHandle);

            newHandles.push({
                id: newHandle.id,
                hook,
            });
        }

        // Return an array of objects that can be used to remove the handlers.
        return newHandles;
    }

    _createHandler(caller: string, method: Function, block = false) {
        const newHandle = {
            id: this.counter,
            caller,
            method,
            block,
        };

        this.counter += 1;

        return newHandle;
    }

    remove(events: HookInfo|HookInfo[]) {
        // Convert hooks to an array to keep flow similar.
        if (!(events instanceof Array)) events = [events];

        for (let i = 0; i < events.length; i += 1) {
            const eventObject = events[i];

            // Now check regular handlers.
            for (let i = 0; i < this.stack[eventObject.hook].length; i += 1) {
                const trigger = this.stack[eventObject.hook][i];

                // Since ID's are unique break after finding one.
                if (trigger.id === eventObject.id) {
                    this.stack[eventObject.hook].splice(i, 1);
                    break;
                }
            }
        }
    }

    // Removes all events from eventhandler.
    // This can be used to release memory when the application is finished.
    destroy() {
        Object.keys(this.stack).forEach((key) => {
            this.stack[key].forEach((event) => {
                this.remove({ id: event.id, hook: key });
            });
        });
    }

    trigger(hook: string, data: any) {
        // Check whether the event exists.
        if (!this.stack[hook]) {
            // console.warn(`EventHandler: '${hook}' is not a registered event.`);
            return;
        }

        // Check whether the event has been disabled.
        if (this.disabledHandles.indexOf(hook) !== -1) {
            // Check whether we have a protected handler if we do trigger that.
            if (this.protectedHandles[hook]) {
                this.protectedHandles[hook](data);
            }

            console.debug(`EventHandler: '${hook}' is disabled, skipping trigger`);
            return;
        }

        // Trigger all regular handles associated with the hook.
        for (let i = 0; i < this.stack[hook].length; i += 1) {
            const eventHandle = this.stack[hook][i];

            try {
                eventHandle.method(data);
            } catch (e) {
                console.error(`EventHandler: Handle from '${eventHandle.caller}' for '${hook}' failed. Error: ${e}`);
            }
        }
    }

    disable(hook: string, callback = noop) {
        this.protectedHandles[hook] = callback;

        if (this.disabledHandles.indexOf(hook) === -1) {
            this.disabledHandles.push(hook);
        }
    }

    enable(hook: string) {
        this.protectedHandles[hook] = noop;

        const hookIndex = this.disabledHandles.indexOf(hook);

        if (hookIndex !== -1) {
            this.disabledHandles.splice(hookIndex, 1);
        }
    }
}

export default EventHandler;
