const fs = require('fs');
const path = require('path');

const srcDir = path.join('src');
const map = {
  '/work-orders': '/ops/work-orders',
  '/schedule': '/ops/schedule',
  '/capacity': '/ops/capacity',
  '/andon': '/ops/andon',
  '/spc': '/ops/spc',
  '/rework': '/ops/rework',
  '/scrap': '/ops/scrap',
  '/reconcile': '/supply/reconcile',
  '/tools': '/supply/tools',
  '/quotations': '/commercial/quotations',
  '/billing': '/commercial/billing',
  '/attendance': '/people/attendance',
  '/leaderboard': '/people/leaderboard',
  '/handover': '/people/handover',
  '/machines': '/system/machines',
  '/maintenance': '/system/maintenance',
  '/fives': '/system/fives',
  '/kaizen': '/system/kaizen',
  '/ideas': '/system/ideas',
  '/safety': '/system/safety',
  '/lean': '/system/lean',
  '/admin': '/system/admin',
  '/operator': '/terminal'
};

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    let p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (p.endsWith('.ts') || p.endsWith('.tsx')) {
      let content = fs.readFileSync(p, 'utf8');
      let original = content;

      Object.keys(map).forEach(oldPath => {
        // Find exact matches like href="/work-orders" or router.push('/work-orders')
        // Regex looks for quotes/backticks around the oldPath, optionally followed by /
        const escapedOldPath = oldPath.replace(/\//g, '\\/');
        const regexExact = new RegExp('([\"\'\`])' + escapedOldPath + '([\"\'\`\/])', 'g');
        content = content.replace(regexExact, (match, p1, p2) => {
          if (p2 === '/') return p1 + map[oldPath] + '/'; // handled dynamic sub-routes
          return p1 + map[oldPath] + p2;
        });

        // Some places might have dynamic routes like `/work-orders/${id}`
        // It's covered by the '/' check above, but if it's `/work-orders?foo`, it's not.
        const regexQuery = new RegExp('([\"\'\`])' + escapedOldPath + '(\\?)', 'g');
        content = content.replace(regexQuery, (match, p1, p2) => {
          return p1 + map[oldPath] + p2;
        });
      });

      if (content !== original) {
        fs.writeFileSync(p, content);
        console.log('Updated links in', p);
      }
    }
  });
}

walk(srcDir);
