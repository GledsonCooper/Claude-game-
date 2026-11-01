/*
 * Catálogo de produtos pagos (dinheiro real).
 * Este arquivo é usado TANTO pelo navegador quanto pelo servidor.
 * O servidor sempre usa o preço daqui — o cliente nunca define o valor cobrado.
 *
 * Para mudar preços, edite apenas este arquivo.
 */
(function () {
  const CATALOG = {
    currency: 'BRL',
    products: {
      starter: {
        name: 'Pacote Inicial',
        desc: '300 💎 + Skin exclusiva Dragão + Moedas em dobro para sempre',
        price: 9.9,
        oncePerPlayer: true,
        badge: 'MELHOR OFERTA -65%',
        grant: { gems: 300, skins: ['dragon'], vip: true },
      },
      gems_small: {
        name: 'Punhado de Gemas',
        desc: '120 💎',
        price: 4.9,
        grant: { gems: 120 },
      },
      gems_medium: {
        name: 'Saco de Gemas',
        desc: '650 💎 (+30% bônus)',
        price: 19.9,
        badge: 'MAIS VENDIDO',
        grant: { gems: 650 },
      },
      gems_large: {
        name: 'Baú de Gemas',
        desc: '1500 💎 (+50% bônus)',
        price: 39.9,
        grant: { gems: 1500 },
      },
      gems_mega: {
        name: 'Tesouro Lendário',
        desc: '4200 💎 (+70% bônus) + Skin Galáxia',
        price: 99.9,
        badge: 'VALOR MÁXIMO',
        grant: { gems: 4200, skins: ['galaxy'] },
      },
      vip: {
        name: 'Passe VIP',
        desc: 'Moedas em dobro para sempre + coroa dourada',
        price: 14.9,
        oncePerPlayer: true,
        grant: { vip: true, skins: ['king'] },
      },
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CATALOG;
  else window.CATALOG = CATALOG;
})();
