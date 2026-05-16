import { Db } from 'mongodb';
import { getDb } from '../../db/pool.js';

type ManufacturerSeed = {
  nom: string;
  pays: string;
  site_web: string;
  icon: string;
};

const MANUFACTURERS: ManufacturerSeed[] = [
  { nom: 'Bosch', pays: 'Allemagne', site_web: 'https://www.bosch.com', icon: 'bosch' },
  { nom: 'Makita', pays: 'Japon', site_web: 'https://www.makita.com', icon: 'makita' },
  { nom: 'DeWalt', pays: 'Etats-Unis', site_web: 'https://www.dewalt.com', icon: 'dewalt' },
  { nom: 'Milwaukee', pays: 'Etats-Unis', site_web: 'https://www.milwaukeetool.com', icon: 'milwaukee' },
  { nom: 'Ryobi', pays: 'Japon', site_web: 'https://www.ryobitools.eu', icon: 'ryobi' },
  { nom: 'Facom', pays: 'France', site_web: 'https://www.facom.com', icon: 'facom' },
  { nom: 'Stanley', pays: 'Etats-Unis', site_web: 'https://www.stanleytools.fr', icon: 'stanley' },
  { nom: 'Black+Decker', pays: 'Etats-Unis', site_web: 'https://www.blackanddecker.fr', icon: 'blackdecker' },
  { nom: 'Metabo', pays: 'Allemagne', site_web: 'https://www.metabo.com', icon: 'metabo' },
  { nom: 'Festool', pays: 'Allemagne', site_web: 'https://www.festool.fr', icon: 'festool' },
  { nom: 'Hilti', pays: 'Liechtenstein', site_web: 'https://www.hilti.fr', icon: 'hilti' },
  { nom: 'Einhell', pays: 'Allemagne', site_web: 'https://www.einhell.fr', icon: 'einhell' },
  { nom: 'AEG', pays: 'Allemagne', site_web: 'https://www.aeg-powertools.eu', icon: 'aeg' },
  { nom: 'HiKOKI', pays: 'Japon', site_web: 'https://www.hikoki-powertools.fr', icon: 'hikoki' },
  { nom: 'Fein', pays: 'Allemagne', site_web: 'https://www.fein.com', icon: 'fein' },
  { nom: 'Karcher', pays: 'Allemagne', site_web: 'https://www.kaercher.com/fr', icon: 'karcher' },
  { nom: 'Leman', pays: 'France', site_web: 'https://www.leman-sa.com', icon: 'leman' },
  { nom: 'Virax', pays: 'France', site_web: 'https://www.virax.com', icon: 'virax' },
  { nom: 'Bost', pays: 'France', site_web: 'https://www.bost.fr', icon: 'bost' },
  { nom: 'Mob Outillage', pays: 'France', site_web: 'https://www.moboutillage.com', icon: 'moboutillage' },
  { nom: 'KS Tools', pays: 'Allemagne', site_web: 'https://www.kstools.com', icon: 'kstools' },
  { nom: 'Bahco', pays: 'Suede', site_web: 'https://www.bahco.com', icon: 'bahco' },
  { nom: 'Bessey', pays: 'Allemagne', site_web: 'https://www.bessey.de', icon: 'bessey' },
  { nom: 'Fiskars', pays: 'Finlande', site_web: 'https://www.fiskars.com', icon: 'fiskars' },
  { nom: 'Wolf Garten', pays: 'Allemagne', site_web: 'https://www.wolfgarten.com', icon: 'wolfgarten' },
  { nom: 'Stihl', pays: 'Allemagne', site_web: 'https://www.stihl.fr', icon: 'stihl' },
  { nom: 'Parkside', pays: 'Allemagne', site_web: 'https://parkside-diy.com/fr', icon: 'parkside' },
  { nom: 'Gardena', pays: 'Allemagne', site_web: 'https://www.gardena.com/fr', icon: 'gardena' },
  { nom: 'Rothenberger', pays: 'Allemagne', site_web: 'https://www.rothenberger.com', icon: 'rothenberger' },
  { nom: 'Rems', pays: 'Allemagne', site_web: 'https://www.rems.de', icon: 'rems' },
  { nom: 'Beta Tools', pays: 'Italie', site_web: 'https://www.beta-tools.com', icon: 'betatools' }
];

export async function seedManufacturers(db: Db): Promise<void> {
  const manufacturers = db.collection('manufacturers');

  await manufacturers.createIndex({ nom: 1 }, { unique: true });

  const now = new Date();
  for (const manufacturer of MANUFACTURERS) {
    await manufacturers.updateOne(
      { nom: manufacturer.nom },
      {
        $set: {
          nom: manufacturer.nom,
          pays: manufacturer.pays,
          site_web: manufacturer.site_web,
          icon: manufacturer.icon,
          updated_at: now
        },
        $setOnInsert: { created_at: now }
      },
      { upsert: true }
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedManufacturers(await getDb())
    .then(() => {
      console.log('Seed manufacturers termine');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Erreur seed manufacturers:', error);
      process.exit(1);
    });
}
