const express = require('express');
const axios = require('axios');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { admin, db } = require('../config/firebase-admin-config');
const nodemailer = require('nodemailer');
const path = require('path');
const { Console } = require('console');
const { DateTime } = require('luxon');
const { exec } = require('child_process');
const qrcode = require('qrcode'); // Importando a biblioteca qrcode
const SMTP_CONFIG = require('../config/smtp')

const CAMINHO_FOOTER = "https://back-end-7vj8.onrender.com/images/footer"

/*name: 'Dominik Biermann',
number: '5412267253445627',
expiry_month: '07',
expiry_year: '24',
cvv: '558'*/
// Função para criar um novo checkout
router.post('/cobranca_pix', async (req, res) => {
  const { id, total, inteira, meia, infantil, data } = req.body;
  const clienteRef = db.collection("Cliente").doc(id);
  // Em seguida, adicione os atributos "meia", "inteira" e "infantil" ao cliente
  function transformDateToBR(dateStr) {
    const [month, day, year] = dateStr.split('/');
    return `${day}/${month}/${year}`;
  }
  const dataBrasileira = transformDateToBR(data);
  const totalEmCentavos = total * 100;
  clienteRef.update({
    meia: meia,
    inteira: inteira,
    infantil: infantil,
    data: dataBrasileira,
    total: total
  })
    .then(() => {
      console.log("Atributos adicionados ao cliente com sucesso!");

      // Obtenha os dados do cliente do banco de dados
      clienteRef.get()
        .then((doc) => {
          if (doc.exists) {
            // O documento existe, agora você pode acessar os campos do cliente
            const clienteData = doc.data();
            const cpf = clienteData.cpf;
            const nome = clienteData.nome;
            const email = clienteData.email;

            console.log("CPF:", cpf);
            console.log("Nome:", nome);
            console.log("E-mail:", email);

            // Crie o objeto postData com os dados corretos do cliente antes de prosseguir
            const postData = {
              "reference_id": id,
              "customer": {
                "name": nome,
                "email": email,
                "tax_id": cpf,
              },
              "qr_codes": [
                {
                  "amount": {
                    "value": totalEmCentavos
                  },
                  "expiration_date": new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas a partir da data atual
                }
              ],
              "notification_urls": [
                "https://back-end-7vj8.onrender.com/pagamento/webhook/pagseguro"
              ]
            };

            const token = "02b6bf6c-b871-4d81-a9ab-fc8b3cdce1674060d42e45caa6112e00ca196d31377b4581-3a5c-454b-bf76-2d164785b12a";
            const url = "https://api.pagseguro.com/orders";

            axios.post(url, postData, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'accept': 'application/json',
                'content-type': 'application/json',
              }
            })
              .then(response => {
                console.log("Resposta:", response.data);

                const qrCodes = response.data.qr_codes;

                if (Array.isArray(qrCodes) && qrCodes.length > 0) {
                  const qrCodeText = qrCodes[0].text;
                  const qrCodeImage = qrCodes[0].links.find(item => item.media === 'image/png')?.href;

                  console.log("QR Code (Texto):", qrCodeText);
                  //console.log("QR Code (Imagem):", qrCodeImage);

                  // Gerando o QR Code a partir do texto fornecido na resposta
                  qrcode.toDataURL(qrCodeText, (err, url) => {
                    if (err) {
                      console.error("Erro ao gerar QR Code:", err);
                      return res.status(500).send("Erro ao gerar QR Code.");
                    }

                    console.log("URL do QR Code em formato de imagem:", url, qrCodeText);
                    const urls = [url, qrCodeText];
                    // Retornando o URL do QR Code em formato de imagem para o front-end
                    return res.send(urls);
                  });
                } else {
                  console.error("Erro: QR Codes não foram encontrados na resposta.");
                  return res.status(500).send("Erro: QR Codes não foram encontrados na resposta.");
                }
              })
              .catch(error => {
                if (error.response) {
                  console.error("Erro:", error.response.data);
                  return res.status(error.response.status).send(error.response.data);
                } else {
                  console.error("Erro desconhecido:", error);
                  return res.status(500).send("Erro desconhecido.");
                }
              });
          } else {
            console.log("Cliente não encontrado.");
            return res.status(404).send("Cliente não encontrado.");
          }
        })
        .catch((error) => {
          console.error("Erro ao obter dados do cliente:", error);
          return res.status(500).send("Erro ao obter dados do cliente.");
        });
    })
    .catch((error) => {
      console.error("Erro ao adicionar atributos ao cliente:", error);
      return res.status(500).send("Erro ao adicionar atributos ao cliente.");
    });
});



router.post('/cobranca_cartao', async (req, res) => {
  const { cardNumber, cardHolder, expiryMonth, expiryYear, cvv, id, email, total_taxa, parcelas, inteira, meia, infantil, data } = req.body;
  const clienteRef = db.collection("Cliente").doc(id);


  // Em seguida, adicione os atributos "meia", "inteira" e "infantil" ao cliente
  function transformDateToBR(dateStr) {
    const [month, day, year] = dateStr.split('/');
    return `${day}/${month}/${year}`;
  }
  const dataBrasileira = transformDateToBR(data);
  clienteRef.update({
    meia: meia,
    inteira: inteira,
    infantil: infantil,
    data: dataBrasileira
  })
    .then(() => {
      console.log("Atributos adicionados ao cliente com sucesso!");
    })
    .catch((error) => {
      console.error("Erro ao adicionar atributos ao cliente:", error);
      return res.status(500).send("Erro ao adicionar atributos ao cliente.");
    });
  // Chama a função para criar um novo checkout
  const createCheckout = async (cardNumber, cardHolder, expiryMonth, expiryYear, cvv, id, email, total_taxa, parcelas, inteira, meia, infantil) => {
    const url2 = 'https://back-end-7vj8.onrender.com/pagamento/webhook/sumup'
    const url = 'https://api.sumup.com/v0.1/checkouts';
    //obrigatorio criar chave privada
    const accessToken = 'sup_sk_PlAjghUPcwWJJCEoKRbTXsbwt2Zed2oUy'; // Substitua pela sua chave de API privada válida da conta final
    const merchantCode = 'MC2ANXXM'; // Substitua pelo código identificador único do perfil do Tiago
    try {
      const response = await axios.post(url, {
        checkout_reference: uuidv4(), // Test
        amount: total_taxa,
        currency: 'BRL',
        //email obrigatorio trocar
        pay_to_email: 'dev_6ooc8357@sumup.com',
        description: id,
        //redirect_url: url2,
        return_url: url2,
        merchant_code: merchantCode, // Adicione o código identificador único do perfil do Tiago
        merchant_name: cardHolder,
        installments_count: parcelas,
      },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }

        });

      const checkoutId = response.data.id;
      console.log('Checkout criado com sucesso:', checkoutId);

      // Conclui o pagamento chamando a função para processar o checkout
      await processCheckout(checkoutId, cardNumber, cardHolder, expiryMonth, expiryYear, cvv, parcelas, inteira, meia, infantil);
    } catch (error) {
      await email_erro(id)
      console.error('Erro ao criar o checkout:', error);
      return res.status(500).send("Erro ao criar o checkout.");
    }
  };

  // Função para concluir o pagamento de um checkout
  const processCheckout = async (checkoutId, cardNumber, cardHolder, expiryMonth, expiryYear, cvv, parcelas, inteira, meia, infantil) => {
    const accessToken = 'sup_sk_PlAjghUPcwWJJCEoKRbTXsbwt2Zed2oUy'; // Adicione o código identificador único do perfil do Tiago, tem um nu webhook tbm

    const url = `https://api.sumup.com/v0.1/checkouts/${checkoutId}`;

    try {
      const response = await axios.put(url, {
        payment_type: 'card',
        card: {
          name: cardHolder,
          number: cardNumber,
          expiry_month: expiryMonth,
          expiry_year: expiryYear,
          cvv: cvv
        },
        installments: parcelas,
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,

          'Content-Type': 'application/json'
        }
      });

      console.log('Checkout processado com sucesso:', response.data);
    } catch (error) {
      await email_erro(checkoutId)
      console.error('Erro ao processar o checkout:', error);
      return "Erro ao processar o checkout.";
    }
  };

  // Chame a função para criar um novo checkout
  createCheckout(cardNumber, cardHolder, expiryMonth, expiryYear, cvv, id, email, total_taxa, parcelas, inteira, meia, infantil);

  return res.send('Checkout criado com sucesso!');
});


router.post('/calcula-valor', async (req, res) => {
  const { qtd1, qtd2, qtd3, data } = req.body;
  let Meia
  let Infantil
  let Inteira
  let total

  const [mes, dia, ano] = data.split('/');
  const diaa = parseInt(data.split('/')[1], 10);

  // Convertendo o valor do mês e do dia para números inteiros
  const mesNumero = parseInt(mes, 10);
  const diaNumero = parseInt(dia, 10);

  // Verificando se os valores de mês e dia são válidos
  if (isNaN(mesNumero) || mesNumero < 1 || mesNumero > 12 || isNaN(diaNumero) || diaNumero < 1 || diaNumero > 31) {
    console.error('Valor inválido para o mês ou dia');
    process.exit(1);
  }

  // Obtendo o nome do mês em português
  const nomeMes = DateTime.fromObject({ year: Number(ano), month: mesNumero, day: diaNumero })
    .setLocale('pt')
    .toLocaleString({ month: 'long' })
    .toLowerCase();

  let valores = await db.collection(`Meses/${nomeMes}/Dados`).doc("Promocao").get();
  if (valores.data().Promocao) {
    valores = await db.collection(`Meses/${nomeMes}/Dados`).doc("Valor_Promocao").get();

    // Verificar se o dia atual está em promoção
    try {
      if (diaa in valores.data().Inteira && valores.data().Inteira[diaa] !== 0) {
        Inteira = valores.data().Inteira[diaa];

      }
      else {
        valores = await db.collection(`Meses/${nomeMes}/Dados`).doc("Valores_ingressos").get();

        try {
          const valoresSnapshot = await valores.data();
          Inteira = valoresSnapshot.Inteira

        } catch (error) {
          console.log("Erro ao obter o conteúdo do documento:", error);
        }
      }
    } catch {
      valores = await db.collection(`Meses/${nomeMes}/Dados`).doc("Valores_ingressos").get();

      try {
        const valoresSnapshot = await valores.data();
        Inteira = valoresSnapshot.Inteira

      } catch (error) {
        console.log("Erro ao obter o conteúdo do documento:", error);
      }
    }

    try {
      if (diaa in valores.data().Meia && valores.data().Meia[diaa] !== 0) {
        Meia = valores.data().Meia[diaa];

      }
      else {
        valores = await db.collection(`Meses/${nomeMes}/Dados`).doc("Valores_ingressos").get();

        try {
          const valoresSnapshot = await valores.data();
          Meia = valoresSnapshot.Meia

        } catch (error) {
          console.log("Erro ao obter o conteúdo do documento:", error);
        }
      }
    } catch {
      valores = await db.collection(`Meses/${nomeMes}/Dados`).doc("Valores_ingressos").get();

      try {
        const valoresSnapshot = await valores.data();
        Meia = valoresSnapshot.Meia
      } catch {
        console.log("Erro ao obter o conteúdo do documento:");
      }
    }




    try {
      if (diaa in valores.data().Infantil && valores.data().Infantil[diaa] !== 0) {
        Infantil = valores.data().Infantil[diaa];

      }
      else {
        valores = await db.collection(`Meses/${nomeMes}/Dados`).doc("Valores_ingressos").get();

        try {
          const valoresSnapshot = await valores.data();
          Infantil = valoresSnapshot.infantil

        } catch (error) {
          console.log("Erro ao obter o conteúdo do documento:", error);
        }
      }
    } catch {
      valores = await db.collection(`Meses/${nomeMes}/Dados`).doc("Valores_ingressos").get();

      try {
        const valoresSnapshot = await valores.data();
        Infantil = valoresSnapshot.infantil

      } catch (error) {
        console.log("Erro ao obter o conteúdo do documento:", error);
      }
    }
    total = (Inteira * qtd1) + (Meia * qtd2) + (Infantil * qtd3);
    return res.send(total.toString());

  } else {
    valores = await db.collection(`Meses/${nomeMes}/Dados`).doc("Valores_ingressos").get();
    try {
      const valoresSnapshot = await valores.data();
      total = (valoresSnapshot.Inteira * qtd1) + (valoresSnapshot.Meia * qtd2) + (valoresSnapshot.infantil * qtd3);

      return res.send(total.toString());

    } catch (error) {
      console.log("Erro ao obter o conteúdo do documento:", error);
    }
  }



});
router.post('/valor_ingresso', async (req, res) => {
  const { data } = req.body;
  let Meia
  let Infantil
  let Inteira
  let total
  const [mes, dia, ano] = data.split('/');
  const diaa = parseInt(data.split('/')[1], 10);

  // Convertendo o valor do mês e do dia para números inteiros
  const mesNumero = parseInt(mes, 10);
  const diaNumero = parseInt(dia, 10);

  // Verificando se os valores de mês e dia são válidos
  if (isNaN(mesNumero) || mesNumero < 1 || mesNumero > 12 || isNaN(diaNumero) || diaNumero < 1 || diaNumero > 31) {
    console.error('Valor inválido para o mês ou dia');
    process.exit(1);
  }

  // Obtendo o nome do mês em português
  const nomeMes = DateTime.fromObject({ year: Number(ano), month: mesNumero, day: diaNumero })
    .setLocale('pt')
    .toLocaleString({ month: 'long' })
    .toLowerCase();

  let valores = await db.collection(`Meses/${nomeMes}/Dados`).doc("Promocao").get();
  if (valores.data().Promocao) {
    valores = await db.collection(`Meses/${nomeMes}/Dados`).doc("Valor_Promocao").get();

    // Verificar se o dia atual está em promoção
    try {
      if (diaa in valores.data().Inteira && valores.data().Inteira[diaa] !== 0) {
        Inteira = valores.data().Inteira[diaa];

      }
      else {
        valores = await db.collection(`Meses/${nomeMes}/Dados`).doc("Valores_ingressos").get();

        try {
          const valoresSnapshot = await valores.data();
          Inteira = valoresSnapshot.Inteira

        } catch (error) {
          console.log("Erro ao obter o conteúdo do documento:", error);
        }
      }
    } catch {
      valores = await db.collection(`Meses/${nomeMes}/Dados`).doc("Valores_ingressos").get();

      try {
        const valoresSnapshot = await valores.data();
        Inteira = valoresSnapshot.Inteira

      } catch (error) {
        console.log("Erro ao obter o conteúdo do documento:", error);
      }
    }
    try {
      if (diaa in valores.data().Meia && valores.data().Meia[diaa] !== 0) {
        Meia = valores.data().Meia[diaa];

      }
      else {
        valores = await db.collection(`Meses/${nomeMes}/Dados`).doc("Valores_ingressos").get();

        try {
          const valoresSnapshot = await valores.data();
          Meia = valoresSnapshot.Meia

        } catch (error) {
          console.log("Erro ao obter o conteúdo do documento:", error);
        }
      }
    } catch {
      valores = await db.collection(`Meses/${nomeMes}/Dados`).doc("Valores_ingressos").get();

      try {
        const valoresSnapshot = await valores.data();
        Meia = valoresSnapshot.Meia

      } catch (error) {
        console.log("Erro ao obter o conteúdo do documento:", error);
      }
    }

    try {
      if (diaa in valores.data().Infantil && valores.data().Infantil[diaa] !== 0) {
        Infantil = valores.data().Infantil[diaa];

      }
      else {
        valores = await db.collection(`Meses/${nomeMes}/Dados`).doc("Valores_ingressos").get();

        try {
          const valoresSnapshot = await valores.data();
          Infantil = valoresSnapshot.infantil

        } catch (error) {
          console.log("Erro ao obter o conteúdo do documento:", error);
        }
      }
    }
    catch {
      valores = await db.collection(`Meses/${nomeMes}/Dados`).doc("Valores_ingressos").get();

      try {
        const valoresSnapshot = await valores.data();
        Infantil = valoresSnapshot.infantil

      } catch (error) {
        console.log("Erro ao obter o conteúdo do documento:", error);
      }
    }
    const data = {
      Inteira: Inteira,
      Meia: Meia,
      infantil: Infantil,
    };
    //total = (Inteira * qtd1) + (Meia * qtd2) + (Infantil * qtd3);
    //return res.send(total.toString());
    return res.send(data);

  } else {
    valores = await db.collection(`Meses/${nomeMes}/Dados`).doc("Valores_ingressos").get();
    try {
      const valoresSnapshot = await valores.data();
      //total = (valoresSnapshot.Inteira * qtd1) + (valoresSnapshot.Meia * qtd2) + (valoresSnapshot.infantil * qtd3);

      return res.send(valoresSnapshot);


    } catch (error) {
      console.log("Erro ao obter o conteúdo do documento:", error);
    }
  }



});
router.post('/calcula-taxa', async (req, res) => {
  const { total } = req.body;
  const taxaDocument = db.collection("Taxa").doc("wvrxA2cLwr20gy6Oy5sl");

  try {
    const docSnapshot = await taxaDocument.get();

    if (docSnapshot.exists) {
      const taxaContent = docSnapshot.data();
      res.send(taxaContent);
    } else {
      console.log("O documento não existe.");
    }
  } catch (error) {
    console.log("Erro ao obter o conteúdo do documento:", error);
  }

  //res.send(total.toString()); // Envia o valor total como resposta para o front-end
});
//3bcc195f-0655-4e62-ada7-e18148acaede
//      'Authorization': `Bearer ${accessToken}`,

/*router.post('/list', async (req, res) => {
  const accessToken = 'sup_sk_4VcM6wGY8D1U6Rb49Ho3bJxyxX9t0KsvS'; // Substitua pela sua chave de API privada válida
  const url = 'https://api.sumup.com/v0.1/checkouts/3bcc195f-0655-4e62-ada7-e18148acaede';


  const data = {
    payment_type: 'card',
    card: {
      name: 'Dominik Biermann',
      number: '4485618386833995',
      expiry_month: '05',
      expiry_year: '29',
      cvv: '257'
    }
  };

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  axios.put(url, data, { headers })
    .then(response => {
      console.log('Response:', response.data);
    })
    .catch(error => {
      console.error('Error:', error.response.data);
    });
});*/


router.post('/Envia_email', async (req, res) => {
  const { id, total, inteira, meia, infantil, data } = req.body;
  const clienteRef = db.collection("Cliente").doc(id);
  function transformDateToBR(dateStr) {
    const [month, day, year] = dateStr.split('/');
    return `${day}/${month}/${year}`;
  }
  const dataBrasileira = transformDateToBR(data);

  // Em seguida, adicione os atributos "meia", "inteira" e "infantil" ao cliente
  clienteRef.update({
    meia: meia,
    inteira: inteira,
    infantil: infantil,
    data: dataBrasileira
  })
    .then(() => {
      console.log("Atributos adicionados ao cliente com sucesso!");
    })
    .catch((error) => {
      console.error("Erro ao adicionar atributos ao cliente:", error);
      return res.status(500).send("Erro ao adicionar atributos ao cliente.");
    });

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "lojaingressostermas@gmail.com",
      pass: 'uidlhuxtlszyxqpb',

    }
  });
  //'aluguetemporadaolimpia@hotmail.com'
  // Destinatários dos emails
  const clientesRef = db.collection('Cliente');

  // Supondo que você tenha o ID do cliente armazenado na variável "id"
  let bairro
  let cep
  let cpf
  let email
  let nome
  let numero
  let rua
  let telefone

  const doc = await clientesRef.doc(id).get();

  if (!doc.exists) {
    console.log("Cliente não encontrado");
    return res.send("Cliente não encontrado");
  } else {
    const clienteData = doc.data();
    // Extrair os dados necessários do cliente
    bairro = clienteData.bairro;
    cep = clienteData.cep;
    cpf = clienteData.cpf;
    email = clienteData.email;
    nome = clienteData.nome;
    numero = clienteData.numero;
    rua = clienteData.rua;
    telefone = clienteData.telefone;

    // Utilize as variáveis conforme necessário
    console.log('Bairro:', bairro);
    console.log('CEP:', cep);
    console.log('CPF:', cpf);
    console.log('Email:', email);
    console.log('Nome:', nome);
    console.log('Número:', numero);
    console.log('Rua:', rua);
    console.log('Telefone:', telefone);
  }


  const destinatarios = ['aluguetemporadaolimpia@hotmail.com', email];
  const nomeCliente = nome;
  const cpfCliente = cpf;
  const emailCliente = email;
  const telefoneCliente = telefone;
  const formaPagamento = 'Retirada';
  const enderecoHospedagem = `Endereço:${rua},${numero} Bairro:${bairro} `;
  const Total = total

  // Construir a mensagem de email
  // colocar logo (arquivo tiago.png) na pasta logos
  const mensagem = {
    from: 'Tralves - Ingressos Thermas <lojaingressostermas@gmail.com>',
    to: destinatarios.join(','),
    subject: 'Confirmação de compra de ingressos',
    html: `
    <h2>Confirmação de compra de ingressos</h2>
    <p>Olá, ${nomeCliente}</p>
    <p>Recebemos seu pagamento:</p>
    <ul>
      <li>Nome do cliente: ${nomeCliente}</li>
      <li>Email: ${emailCliente}</li>
      <li>Telefone: ${telefoneCliente}</li>
      <li>Data dos ingressos : ${dataBrasileira}</li>
      <li>Total: R$${Total}</li>
      <li>Forma de pagamento: ${formaPagamento}</li>
      </ul> 

      <p>Quantidade de ingressos:</p>
      <ul>
        <li>Inteira: ${inteira}</li>
        <li>Meia: ${meia}</li>
        <li>Infantil: ${infantil}</li>
      </ul>
    <p>Caso tenha alguma dúvida, entre em contato conosco pelo numero (17) 99744-7717.</p>
    <p>Atenciosamente,<br>Equipe de Vendas</p>
    <img src="${CAMINHO_FOOTER}" alt="Redes sociais e site do Alugue Temporada Olímpia" />
  `
  };


  try {
    // Enviar o email
    const info = await transporter.sendMail(mensagem);
    console.log('Email enviado:', info.response);
    //res.status(200).send('Email enviado com sucesso!');
  } catch (error) {
    console.error('Erro ao enviar o email:', error);
    return res.status(500).send('Erro ao enviar o email');
    //res.status(500).send('Erro ao enviar o email');
  }

  return res.status(200).send('Email enviado com sucesso!');

})
router.post('/webhook/sumup', async (req, res) => {
  const payload = req.body;
  console.log('testetetsifhiasd: ', payload);
  if (payload.event_type === 'CHECKOUT_STATUS_CHANGED') {
    const checkoutId = payload.id;
    const status = payload.status;
    console.log(status)
    if (status == 'SUCCESSFUL') {
      let config = {
        method: 'get',
        url: `https://api.sumup.com/v0.1/checkouts/${checkoutId}`,
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer sup_sk_56VKtLezaqaxoTRIw72hJXwxvuRJZTkAp`,
        }
      };

      const response = await axios(config);
      console.log(JSON.stringify(response.data));
      if (response.data.status == 'PAID') {
        email(response.data.description, response.data.amount, 'Cartão')
      } else {
        await email_erro(response.data.description)
      }
      console.log(checkoutId);
    }
    res.status(200).end();
  }
});


router.post('/webhook/pagseguro', (req, res) => {
  const payload = req.body;
  console.log(payload);

  if (payload.charges && payload.charges.length > 0) {
    const charge = payload.charges[0];

    if (charge.status === 'PAID' && charge.payment_response && charge.payment_response.message === 'SUCESSO') {
      const referenceId = payload.reference_id;
      const total = payload.qr_codes && payload.qr_codes.length > 0 ? payload.qr_codes[0].amount.value : null;

      if (total !== null && referenceId) {
        console.log('Valor Total:', total);
        console.log('Reference ID:', referenceId);
        const totalEmReais = total / 100;
        // Faça o que precisar com os valores total e referenceId aqui
        // Por exemplo, enviar um e-mail:
        email(referenceId, totalEmReais, 'Pix')
          .then(() => {
            res.status(200).end();
          })
          .catch((error) => {
            console.error('Erro no envio do email:', error);
            res.status(500).json({ error: 'Internal Server Error' });
          });
      } else {
        email_erro(payload.reference_id)
          .then(() => {
            res.status(200).end();
          })
          .catch((error) => {
            console.error('Erro no envio do email de erro:', error);
            res.status(500).json({ error: 'Internal Server Error' });
          });
      }
    } else {
      res.status(200).end();
    }
  } else {
    res.status(200).end();
  }
});


const email_erro = async (id) => {

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "lojaingressostermas@gmail.com",
      pass: 'uidlhuxtlszyxqpb',

    }
  });
  //'aluguetemporadaolimpia@hotmail.com'
  // Destinatários dos emails
  const clientesRef = db.collection('Cliente');

  // Supondo que você tenha o ID do cliente armazenado na variável "id"
  let nome
  const doc = await clientesRef.doc(id).get();

  if (!doc.exists) {
    console.log("Cliente não encontrado");
    return "Cliente não encontrado";
  } else {
    const clienteData = doc.data();
    // Extrair os dados necessários do cliente
    nome = clienteData.nome;
    // Utilize as variáveis conforme necessário

  }


  const destinatarios = ['aluguetemporadaolimpia@hotmail.com', email];
  const nomeCliente = nome;
  const caminhoLogo = path.join(__dirname, '..', 'logos', 'tiago.png');

  // Construir a mensagem de email
  // colocar logo (arquivo tiago.png) na pasta logos
  const mensagem = {
    from: 'Tralves - Ingressos Thermas <lojaingressostermas@gmail.com>',
    to: destinatarios.join(','),
    subject: 'Erro na compra de ingressos',
    html: `
    <h2>Erro na compra dos ingressos</h2>
    <p>Prezado ${nomeCliente},</p>
    
    <p>Lamentamos informar que ocorreu um erro durante o processamento do pagamento da compra de seus ingressos. Pedimos desculpas pelo inconveniente causado.</p>
    
    <p>Solicitamos que, por gentileza, entre em contato conosco o mais breve possível para que possamos resolver essa questão e ajudá-lo a concluir a compra dos ingressos desejados.</p>
    
    <p>Se houver qualquer dúvida ou necessidade de suporte adicional, não hesite em nos contatar pelo número de telefone abaixo:</p>

    <p>Telefone: (17) 99744-7717</p>
    
    <p>Estamos empenhados em resolver essa situação prontamente e garantir que você tenha uma experiência positiva com nossos serviços.</p>
    
    <p>Atenciosamente,<br>Equipe de Vendas</p>
    <img src="${CAMINHO_FOOTER}" alt="Redes sociais e site do Alugue Temporada Olímpia" />
  `
  };


  try {
    // Enviar o email
    const info = await transporter.sendMail(mensagem);
    console.log('Email enviado:', info.response);
    //res.status(200).send('Email enviado com sucesso!');
  } catch (error) {
    console.error('Erro ao enviar o email:', error);
    //res.status(500).send('Erro ao enviar o email');
  }

}


const email = async (id, total, pagamento) => {

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "lojaingressostermas@gmail.com",
      pass: 'uidlhuxtlszyxqpb',

    }
  });
  //'aluguetemporadaolimpia@hotmail.com'
  // Destinatários dos emails
  const clientesRef = db.collection('Cliente');

  // Supondo que você tenha o ID do cliente armazenado na variável "id"
  let bairro
  let cep
  let email
  let nome
  let numero
  let rua
  let telefone
  let meia
  let inteira
  let infantil
  let data

  const doc = await clientesRef.doc(id).get();

  if (!doc.exists) {
    console.log("Cliente não encontrado");
    return res.send("Cliente não encontrado");
  } else {
    const clienteData = doc.data();
    // Extrair os dados necessários do cliente
    bairro = clienteData.bairro;
    cep = clienteData.cep;
    email = clienteData.email;
    nome = clienteData.nome;
    numero = clienteData.numero;
    rua = clienteData.rua;
    telefone = clienteData.telefone;
    meia = clienteData.meia
    inteira = clienteData.inteira
    infantil = clienteData.infantil
    data = clienteData.data
    // Utilize as variáveis conforme necessário
    console.log('Bairro:', bairro);
    console.log('CEP:', cep);
    console.log('Email:', email);
    console.log('Nome:', nome);
    console.log('Número:', numero);
    console.log('Rua:', rua);
    console.log('Telefone:', telefone);
  }


  const destinatarios = ['aluguetemporadaolimpia@hotmail.com', email];
  const nomeCliente = nome;
  const emailCliente = email;
  const telefoneCliente = telefone;
  const formaPagamento = pagamento;
  const enderecoHospedagem = `Endereço:${rua},${numero} Bairro:${bairro} `;
  const Total = total
  const caminhoLogo = path.join(__dirname, '..', 'logos', 'tiago.png');

  // Construir a mensagem de email
  // colocar logo (arquivo tiago.png) na pasta logos
  const mensagem = {
    from: 'Tralves - Ingressos Thermas <lojaingressostermas@gmail.com>',
    to: destinatarios.join(','),
    subject: 'Confirmação de compra de ingressos',
    html: `
    <h2>Confirmação de compra de ingressos</h2>
    <p>Olá, ${nomeCliente}</p>
    <p>Recebemos seu pagamento:</p>
    <ul>
      <li>Nome do cliente: ${nomeCliente}</li>
      <li>Email: ${emailCliente}</li>
      <li>Telefone: ${telefoneCliente}</li>
      <li>Data dos ingressos : ${data}</li>
      <li>Total: R$${Total}</li>
      <li>Forma de pagamento: ${formaPagamento}</li>
      </ul> 

      <p>Quantidade de ingressos:</p>
      <ul>
      <li>inteira: ${inteira}</li>
      <li>meia: ${meia}</li>
      <li>infantil: ${infantil}</li>
      </ul>

      <p>Endereço de entrega:</p>
      <ul>
      <li>Rua: ${rua},${numero}</li>
      <li>Bairro ${bairro}</li>
      </ul>
    <p>Caso tenha alguma dúvida, entre em contato conosco pelo numero (17) 99744-7717.</p>
    <p>Atenciosamente,<br>Equipe de Vendas</p>
    <img src="${CAMINHO_FOOTER}" alt="Redes sociais e site do Alugue Temporada Olímpia" />
  `
  };


  try {
    // Enviar o email
    const info = await transporter.sendMail(mensagem);
    console.log('Email enviado:', info.response);
    //res.status(200).send('Email enviado com sucesso!');
  } catch (error) {
    console.error('Erro ao enviar o email:', error);
    //res.status(500).send('Erro ao enviar o email');
  }

}

router.get('/cpo/:mes', async (req, res) => {
  let { mes } = req.params

  if (!mes) {
    return res.status(400).json({ error: 'Mês não informada' });
  }
  // nome do mes
  const meses = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho',
    'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  mes = meses[mes - 1];

  // CPO PATH
  // Meses(collection) -> mes(document) -> Dados(subcollection) -> CPO(document) -> CPO(array)
  const docRef = db.collection("Meses")
    .doc(mes)
    .collection("Dados")
    .doc("CPO");

  const doc = await docRef.get();
  const CPO = doc.data().CPO;

  console.log(CPO);

  return res.json(CPO);
})

module.exports = router
//module.exports = GerarnovaFatura1
