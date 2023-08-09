const express = require('express');
const cors = require('cors');
const app = express();
const path = require('path');

const clientesRouter = require('./routes/clientes.js');
const dataRouter = require('./routes/data.js');
const pagamentoRouter = require('./routes/pagamento.js');
const logoRouter = require('./routes/logos.js');

// static folder -> src/public
app.use(express.static(path.join(__dirname, '...', 'public')));

app.use(cors({
    origin: '*'
}));
app.use(express.json());

app.use("/clientes", clientesRouter);
app.use("/data", dataRouter);
app.use("/pagamento", pagamentoRouter);
app.use("/images", logoRouter);

app.listen(process.env.PORT ? Number(process.env.PORT) : 3333, () => {
    console.log('Servidor iniciado na porta 3333!');
});

