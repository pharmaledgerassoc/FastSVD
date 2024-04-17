const constants = require("../moduleConstants");
const stateVariables = ["__timeOfLastChange", "__version"];

/*
    Description is a JSON in format { [functionName:function1], actions : [action1, action2, ...] }
    The SVDBase instances will look like normal JS objects with methods from description and actions mixed together.
 */

function SVDBase(svdIdentifier, state, description, transaction, callCtor) {
    let self = this;

    this.getUID = function () {
        return svdIdentifier.getUID();
    }

    this.getStringId = function () {
        return svdIdentifier.getStringId();
    }

    this.getTransaction = function () {
        return transaction;
    }

    function generateReadOnlyFunction(f) {
        return f.bind(self);
    }

    this.now = function () {
        return self.__timeOfLastChange;
    }

    function generateModifier(fn, f) {
        let boundFunc = f.bind(self);
        return function (...args) {
            self.__timeOfLastChange = Date.now();
            transaction.audit(self, fn, ...args);
            return boundFunc(...args);
        }.bind(self)
    }

    for (let fn in description) {
        if (typeof description[fn] == 'function') {
            this[fn] = generateReadOnlyFunction(description[fn])
        }
    }

    let actions = description[constants.ACTIONS];
    if (actions == undefined) {
        throw new Error("No actions defined for destiption of SVD  " + svdIdentifier.getType() + "  !!! actions:{} is mandatory");
    }
    for (let fn in actions) {
        if (this[fn] != undefined) {
            throw new Error("Function name collision in action: " + fn);
        }
        this[fn] = generateModifier(fn, actions[fn])
    }

    if (callCtor) {
        if (this.ctor) {
            try {
                transaction.audit(self, "ctor", ...state);
                this.ctor(...state);
                if (this._ctor) {
                    this._ctor();
                }
            } catch (err) {
                let newError = new Error("Ctor initialisation for" + svdIdentifier.getTypeName() + " failed to run properly. See .previous for details");
                newError.previous = err;
                throw newError;
            }
        } else {
            throw new Error("Ctor not defined for " + svdIdentifier.getTypeName());
        }
    } else {
        if (state) {
            for (let key in state) {
                if (this[key] != undefined) {
                    throw new Error("State cant contain functions. Key name collision in state: " + key);
                }
                this[key] = state[key];
            }
        }
        if (this._ctor) {
            this._ctor();
        }
    }

    this.getState = function () {
        let state = {};
        for (let key in self) {
            if (typeof self[key] != 'function') {
                if (key.charAt(0) != "_" || stateVariables.includes(key))
                    state[key] = self[key];
            }
        }
        return state;
    }
}

module.exports = SVDBase;