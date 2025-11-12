/**
 * Получает форму слова "обработка" в винительном падеже
 * для описания "на X обработку/обработки/обработок"
 */
export function getProcessingWordAccusative(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'обработок';
  }

  if (lastDigit === 1) {
    return 'обработку';
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'обработки';
  }

  return 'обработок';
}

/**
 * Получает форму слова "обработка" в именительном падеже
 * для label "X обработка/обработки/обработок"
 */
export function getProcessingWordNominative(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'обработок';
  }

  if (lastDigit === 1) {
    return 'обработка';
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'обработки';
  }

  return 'обработок';
}

/**
 * Получает форму слова "фотография" в родительном падеже
 * для "X фотография/фотографии/фотографий"
 */
export function getPhotoWordGenitive(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'фотографий';
  }

  if (lastDigit === 1) {
    return 'фотография';
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'фотографии';
  }

  return 'фотографий';
}

