const jwt = require("jsonwebtoken");

const SEGREDO = process.env.JWT_SECRET || "segredo-de-desenvolvimento";

// Protege rotas que exigem que o administrador esteja autenticado.
// Regra lógica: SE o token for válido ENTÃO permite acesso.
// CASO CONTRÁRIO bloqueia o acesso e informa que as credenciais são inválidas.
function exigirAutenticacao(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ erro: "Acesso não autorizado. Faça login novamente." });
  }

  try {
    const payload = jwt.verify(token, SEGREDO);
    req.usuario = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ erro: "Sessão inválida ou expirada. Faça login novamente." });
  }
}

module.exports = { exigirAutenticacao, SEGREDO };
