const express = require('express');
const router = express.Router();
const { admin, db } = require('../config/firebase-admin-config');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

router.get('/disponivel', async (req, res) => {
  const meses = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const mesesDisponiveis = [];

  try {
    const dataAtual = new Date();
    const anoAtual = dataAtual.getFullYear();
    const mesAtual = dataAtual.getMonth() + 1;

    for (let i = 0; i < meses.length; i++) {
      const snapshot = await db.collection(`Meses/${meses[i]}/Dados`)
        .where("Disponibilidade", "==", true) // Filtra apenas os meses com Disponibilidade igual a true
        .get();

      const anoSnapshot = await db.collection(`Meses/${meses[i]}/Dados`).doc("Ano").get();
      const anoData = anoSnapshot.data();
      console.log(anoData);

      snapshot.forEach((doc) => {
        const data = doc.data();
        const mesData = {
          mês: meses[i],
          disponibilidade: true,
          ano: anoData.hasOwnProperty("Mes_Referente_Ano") ? anoData.Mes_Referente_Ano : null
        };

        if (anoData.Mes_Referente_Ano < anoAtual || (anoData.Mes_Referente_Ano === anoAtual && i < mesAtual - 1)) {
          mesData.disponibilidade = false;
          db.collection(`Meses/${meses[i]}/Dados`).doc(doc.id).update({ Disponibilidade: false });
        } else {
          mesesDisponiveis.push(mesData);
        }
      });
    }

    console.log('teste', mesesDisponiveis);
    res.json(mesesDisponiveis);
  } catch (error) {
    console.error("Erro ao buscar meses:", error);
    res.status(500).json({ error: "Erro ao buscar meses" });
  }
});

module.exports = router;
