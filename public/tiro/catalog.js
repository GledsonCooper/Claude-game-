/*
 * Blitz Estelar — produtos pagos (dinheiro real).
 * Usado TANTO pelo navegador quanto pelo servidor (server.js junta este catálogo ao do Pulim).
 * O servidor sempre cobra o preço daqui; o navegador nunca define o valor.
 * Todos os códigos (SKU) começam com "nb_" para não misturar com os produtos do Pulim.
 */
(function () {
  const CATALOG = {
    currency: 'BRL',
    products: {
      nb_starter: {
        game: 'Blitz Estelar',
        name: 'Pacote Piloto',
        desc: '300 💎 + Nave Fênix (drone + escudo) + 5 bombas',
        price: 9.9,
        oncePerPlayer: true,
        badge: 'OFERTA ÚNICA -70%',
        grant: { gems: 300, skins: ['phoenix'], items: { bomb: 5 } },
      },
      nb_gems_s: {
        game: 'Blitz Estelar',
        name: 'Cristais Pequeno',
        desc: '120 💎',
        price: 4.9,
        grant: { gems: 120 },
      },
      nb_gems_m: {
        game: 'Blitz Estelar',
        name: 'Cofre de Cristais',
        desc: '650 💎 (+30% bônus)',
        price: 19.9,
        badge: 'MAIS VENDIDO',
        grant: { gems: 650 },
      },
      nb_gems_l: {
        game: 'Blitz Estelar',
        name: 'Carga de Cristais',
        desc: '1500 💎 (+50% bônus)',
        price: 39.9,
        grant: { gems: 1500 },
      },
      nb_mega: {
        game: 'Blitz Estelar',
        name: 'Arsenal Lendário',
        desc: '4200 💎 (+70% bônus) + Nave Abismo + 15 bombas',
        price: 99.9,
        badge: 'VALOR MÁXIMO',
        grant: { gems: 4200, skins: ['void'], items: { bomb: 15 } },
      },
      nb_vip: {
        game: 'Blitz Estelar',
        name: 'Passe Comandante',
        desc: 'Moedas x2 para sempre + 1 continuar grátis por partida + Nave Imperial + sem anúncios',
        price: 14.9,
        oncePerPlayer: true,
        grant: { vip: true, skins: ['royal'] },
      },
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CATALOG;
  else window.CATALOG = CATALOG;
})();
