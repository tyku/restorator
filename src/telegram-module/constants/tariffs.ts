export interface Tariff {
  id: string;
  name: string;
  amount: number; // количество обработок
  price: number; // цена в звездах (XTR)
  label: string; // отображаемое название
}

export const TARIFFS: Tariff[] = [
  {
    id: 'tariff_1',
    name: '1 обработка',
    amount: 1,
    price: 10,
    label: '🎨 1 за 10⭐',
  },
  {
    id: 'tariff_3',
    name: '3 обработки',
    amount: 3,
    price: 25,
    label: '🎨 3 за 25⭐',
  },
  {
    id: 'tariff_10',
    name: '10 обработок',
    amount: 10,
    price: 70,
    label: '🎨 10 за 70⭐',
  },
  {
    id: 'tariff_20',
    name: '20 обработок',
    amount: 20,
    price: 120,
    label: '🎨 20 за 120⭐',
  },
];

export function getTariffById(id: string): Tariff | undefined {
  return TARIFFS.find((tariff) => tariff.id === id);
}

