const config = require("./src/config/config"); console.log("Config loaded:", !!config); console.log("Port:", config.port || "not found");
