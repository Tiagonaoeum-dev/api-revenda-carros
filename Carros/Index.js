const express = require('express');
const { Sequelize, DataTypes, Op } = require('sequelize');

const app = express();
app.use(express.json());

// BANCO SQLITE
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './revenda_carros.db',
  logging: false
});

// MODELO CARRO
const Carro = sequelize.define('Carro', {
  modelo: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },

  marca: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },

  ano: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1900
    }
  },

  cor: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },

  preco: {
    type: DataTypes.FLOAT,
    allowNull: false,
    validate: {
      min: 0
    }
  },

  quantidade: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  }

}, {
  tableName: 'carros',
  timestamps: false
});

// MODELO HISTÓRICO
const Movimento = sequelize.define('Movimento', {
  tipo: {
    type: DataTypes.STRING, // entrada ou venda
    allowNull: false
  },

  quantidade: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

  descricao: {
    type: DataTypes.STRING
  }

}, {
  tableName: 'movimentos',
  timestamps: true
});

// RELAÇÃO
Carro.hasMany(Movimento);
Movimento.belongsTo(Carro);

// CRIAR TABELAS
sequelize.sync();

// ----------------------
// ROTAS
// ----------------------

// LISTAR COM FILTROS
app.get('/carros', async (req, res) => {
  const { marca, ano, min, max, disponivel } = req.query;

  let where = {};

  if (marca) {
    where.marca = marca;
  }

  if (ano) {
    where.ano = ano;
  }

  if (min || max) {
    where.preco = {};
    if (min) where.preco[Op.gte] = min;
    if (max) where.preco[Op.lte] = max;
  }

  if (disponivel === 'true') {
    where.quantidade = {
      [Op.gt]: 0
    };
  }

  const carros = await Carro.findAll({ where });
  res.json(carros);
});

// BUSCAR POR ID
app.get('/carros/:id', async (req, res) => {
  const carro = await Carro.findByPk(req.params.id);

  if (!carro) {
    return res.status(404).json({ erro: "Carro não encontrado" });
  }

  res.json(carro);
});

// CADASTRAR
app.post('/carros', async (req, res) => {
  try {
    const novo = await Carro.create(req.body);

    res.status(201).json({
      mensagem: "Carro cadastrado!",
      id: novo.id
    });

  } catch (error) {
    res.status(400).json({
      erro: error.errors[0].message
    });
  }
});

// EDITAR
app.put('/carros/:id', async (req, res) => {
  const carro = await Carro.findByPk(req.params.id);

  if (!carro) {
    return res.status(404).json({ erro: "Carro não encontrado" });
  }

  try {
    await carro.update(req.body);
    res.json({ mensagem: "Carro atualizado!" });

  } catch (error) {
    res.status(400).json({
      erro: error.errors[0].message
    });
  }
});

// EXCLUIR
app.delete('/carros/:id', async (req, res) => {
  const carro = await Carro.findByPk(req.params.id);

  if (!carro) {
    return res.status(404).json({ erro: "Carro não encontrado" });
  }

  await carro.destroy();

  res.json({ mensagem: "Carro removido!" });
});

// ENTRADA NO ESTOQUE
app.post('/carros/:id/entrada', async (req, res) => {
  const { quantidade } = req.body;

  const carro = await Carro.findByPk(req.params.id);

  if (!carro) {
    return res.status(404).json({ erro: "Carro não encontrado" });
  }

  carro.quantidade += quantidade;
  await carro.save();

  await Movimento.create({
    tipo: 'entrada',
    quantidade,
    descricao: 'Entrada no estoque',
    CarroId: carro.id
  });

  res.json({ mensagem: "Entrada registrada!" });
});

// VENDA / SAÍDA
app.post('/carros/:id/venda', async (req, res) => {
  const { quantidade } = req.body;

  const carro = await Carro.findByPk(req.params.id);

  if (!carro) {
    return res.status(404).json({ erro: "Carro não encontrado" });
  }

  if (carro.quantidade < quantidade) {
    return res.status(400).json({
      erro: "Estoque insuficiente"
    });
  }

  carro.quantidade -= quantidade;
  await carro.save();

  await Movimento.create({
    tipo: 'venda',
    quantidade,
    descricao: 'Venda realizada',
    CarroId: carro.id
  });

  res.json({ mensagem: "Venda registrada!" });
});

// HISTÓRICO
app.get('/carros/:id/historico', async (req, res) => {
  const historico = await Movimento.findAll({
    where: {
      CarroId: req.params.id
    },
    order: [['createdAt', 'DESC']]
  });

  res.json(historico);
});

// SERVIDOR
app.listen(3000, () => {
  console.log('Servidor rodando em http://localhost:3000');
});
