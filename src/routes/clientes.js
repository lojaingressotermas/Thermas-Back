const express = require('express');
const router = express.Router();
const { admin, db } = require('../config/firebase-admin-config');
const axios = require('axios');

router.post('/add-cliente', async (req, res) => {
    const { nome, cpf, email, telefone, cep, rua, bairro, numero } = req.body;
    db.collection("Cliente").add({
        nome: nome,
        cpf: cpf,
        email: email,
        telefone: telefone,
        cep: cep,
        rua: rua,
        bairro: bairro,
        numero: numero
    })
        .then((docRef) => {
            console.log("Documento adicionado com ID:", docRef.id);
            res.send(docRef.id);
        })
        .catch((error) => {
            console.error("Erro ao adicionar documento:", error);
        });

})

router.get('/nome/:user', async (req, res) => {
    const { user } = req.params
    const nomeDocRef = db.collection('Cliente').doc(user);

    try {
        const docSnap = await nomeDocRef.get()

        if (docSnap.exists) {
            const nomeCliente = docSnap.data().nome;
            return res.json({
                nomeCliente
            })
        } else {
            throw new Error('O documento não existe.');
        }
    } catch (error) {
        return res.status(404).json({
            erro: "Não foi possível achar o nome do cliente"
        })
    }

})
module.exports = router
