// ==========================
// Модель переменной
// ==========================
class Variable {
    constructor(name) {
        this.name = name;
        this.value = 0;
    }
}

// ==========================
// Интерпретатор
// ==========================
class Interpreter {
    constructor() {
        this.variables = {};
        this.output = [];
    }

    reset() {
        this.variables = {};
        this.output = [];
    }

    execute(blocks) {
        this.reset();

        for (let i = 0; i < blocks.length; i++) {
            try {
                this.executeBlock(blocks[i]);
            } catch (err) {
                return {
                    success: false,
                    error: err.message,
                    errorBlock: blocks[i].element,
                    variables: this.variables,
                    output: this.output
                };
            }
        }

        return {
            success: true,
            variables: this.variables,
            output: this.output
        };
    }

    executeBlock(block) {
        const el = block.element;
        const type = el.dataset.type;

        if (type === "var") {
            this.handleDeclaration(el);
        } else if (type === "assign") {
            this.handleAssignment(el);
        } else {
            throw new Error("Неизвестный тип блока");
        }
    }

    handleDeclaration(el) {
        const input = el.querySelector("input");
        if (!input) throw new Error("Ошибка объявления");

        const names = input.value.split(",").map(n => n.trim());

        names.forEach(name => {
            if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
                throw new Error("Некорректное имя: " + name);
            }

            if (this.variables[name]) {
                throw new Error("Переменная уже объявлена: " + name);
            }

            this.variables[name] = new Variable(name);
        });

        this.output.push("Объявлены: " + names.join(", "));
    }

    handleAssignment(el) {
        const inputs = el.querySelectorAll("input");
        if (inputs.length < 2) throw new Error("Ошибка присваивания");

        const name = inputs[0].value.trim();
        const expr = inputs[1].value.trim();

        if (!this.variables[name]) {
            throw new Error("Переменная не объявлена: " + name);
        }

        const value = this.evaluateExpression(expr);
        this.variables[name].value = value;

        this.output.push(name + " = " + value);
    }

    // ===== Разбор выражений =====

    evaluateExpression(expr) {
        const tokens = this.tokenize(expr);
        const result = this.parseAddSub(tokens);
    
        if (tokens.length > 0) {
            throw new Error("Лишние символы в выражении");
        }
    
        return result;
    }

    tokenize(expr) {
        const tokens = [];
        let buffer = "";

        for (let ch of expr) {
            if ("+-*/%()".includes(ch)) {
                if (buffer) {
                    tokens.push(buffer);
                    buffer = "";
                }
                tokens.push(ch);
            } else if (ch !== " ") {
                buffer += ch;
            }
        }

        if (buffer) tokens.push(buffer);
        return tokens;
    }

    parseAddSub(tokens) {
        let value = this.parseMulDiv(tokens);

        while (tokens[0] === "+" || tokens[0] === "-") {
            const op = tokens.shift();
            const right = this.parseMulDiv(tokens);
            value = op === "+" ? value + right : value - right;
        }

        return value;
    }

    parseMulDiv(tokens) {
        let value = this.parsePrimary(tokens);

        while (["*", "/", "%"].includes(tokens[0])) {
            const op = tokens.shift();
            const right = this.parsePrimary(tokens);

            if (op === "*") value *= right;
            else if (op === "/") {
                if (right === 0) throw new Error("Деление на 0");
                value = Math.floor(value / right);
            }
            else if (op === "%") {
                if (right === 0) throw new Error("Деление на 0");
                value %= right;
            }
        }

        return value;
    }

    parsePrimary(tokens) {
        const token = tokens.shift();
        if (!token) throw new Error("Неверное выражение");
    
        if (token === "(") {
            const value = this.parseAddSub(tokens);
    
            if (tokens[0] !== ")") {
                throw new Error("Ожидалась закрывающая скобка");
            }
    
            tokens.shift();
            return value;
        }
    
        if (!isNaN(token)) return parseInt(token);
    
        if (this.variables[token]) return this.variables[token].value;
    
        throw new Error("Неизвестный токен: " + token);
    }
}

// ==========================
// UI
// ==========================
class UIManager {
    constructor() {
        this.dropZone = document.getElementById("dropZone");
        this.runBtn = document.getElementById("run");
        this.clearBtn = document.getElementById("clear");
        this.output = document.getElementById("output");
        this.varsArea = document.getElementById("vars");
        this.errors = document.getElementById("errors");

        this.blocks = [];
        this.interpreter = new Interpreter();

        this.init();
    }

    init() {
        this.setupDragAndDrop();
        this.runBtn.onclick = () => this.run();
        this.clearBtn.onclick = () => this.clear();
    }

    setupDragAndDrop() {
        const paletteBlocks = document.querySelectorAll(".block");

        paletteBlocks.forEach(block => {
            block.addEventListener("dragstart", e => {
                e.dataTransfer.setData("text/plain", block.outerHTML);
            });
        });

        this.dropZone.addEventListener("dragover", e => {
            e.preventDefault();
        });

        this.dropZone.addEventListener("drop", e => {
            e.preventDefault();

            const html = e.dataTransfer.getData("text/plain");
            const wrapper = document.createElement("div");
            wrapper.innerHTML = html;

            const newBlock = wrapper.firstElementChild;
            newBlock.classList.add("workspace-block");
            newBlock.draggable = false;

            this.dropZone.appendChild(newBlock);

            this.blocks.push({
                element: newBlock
            });
        });
    }

    run() {
        this.errors.textContent = "";
        this.blocks.forEach(b => b.element.classList.remove("error"));

        if (this.blocks.length === 0) {
            this.errors.textContent = "Нет блоков для выполнения";
            return;
        }

        const result = this.interpreter.execute(this.blocks);

        if (!result.success) {
            this.errors.textContent = result.error;
            result.errorBlock.classList.add("error");
        }

        this.output.textContent = result.output.join("\n");

        const vars = {};
        for (let key in result.variables) {
            vars[key] = result.variables[key].value;
        }

        this.varsArea.textContent = JSON.stringify(vars, null, 2);
    }

    clear() {
        this.dropZone.innerHTML =
            '<p class="placeholder">Сюда нужно перетаскивать блоки</p>';

        this.blocks = [];
        this.output.textContent = "";
        this.varsArea.textContent = "{}";
        this.errors.textContent = "";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new UIManager();
});