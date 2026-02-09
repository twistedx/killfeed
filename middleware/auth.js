// middleware/auth.js
const requireAuth = (req, res, next) => 
  req.session?.user ? next() : res.redirect('/');

const requireAdmin = (req, res, next) => 
  req.session?.user?.isAdmin ? next() : res.status(403).send('Admin access required');

const requireModerator = (req, res, next) => 
  req.session?.user && (req.session.user.isModerator || req.session.user.isAdmin) 
    ? next() : res.status(403).send('Moderator access required');

module.exports = { requireAuth, requireAdmin, requireModerator };