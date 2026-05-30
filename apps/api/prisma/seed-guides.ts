/* eslint-disable no-console */
import type { PrismaClient } from '@prisma/client';

interface GuideSeed {
  slug: string;
  title: string;
  platforms: string;
  contentMd: string;
  sortOrder: number;
}

const NEKOBOX_MD = `## Установка

1. Откройте Google Play или [страницу релизов Nekoray](https://github.com/MatsuriDayo/NekoBoxForAndroid/releases) и установите Nekobox.
2. Запустите приложение, при первом запуске разрешите создание VPN-подключения.

## Импорт подписки

Самый быстрый способ — скан QR-кода:

1. В личном кабинете на proxels.ru откройте раздел «Моя подписка».
2. В Nekobox нажмите **+** → **Сканировать QR**.
3. Наведите камеру на QR-код. Через секунду профиль появится в списке.

Альтернатива — копирование URL:

1. В личном кабинете нажмите **«Копировать»** под подписочной ссылкой.
2. В Nekobox: **+** → **Импорт из буфера обмена**.

## Подключение

1. В списке профилей нажмите **«Группы профилей» → «Обновить»** — Nekobox подтянет
   актуальный список нод.
2. Выберите ближайший сервер (или **Auto** для автовыбора).
3. Нажмите большую круглую кнопку в центре экрана.

Когда соединение установлено — иконка ключа появится в статус-баре Android.

## Проблемы

**«Не удалось подключиться»** — обновите подписку (свайп вниз в группе профилей).
Возможно, конкретная нода временно недоступна — Nekobox попробует следующую.

**«Connection timed out»** — проверьте интернет-соединение. Если работает только
с включённым VPN — это нормально для Reality-протокола.
`;

const HIDDIFY_MD = `## Установка

Hiddify работает на всех платформах. Скачайте с [официального сайта](https://hiddify.com/):

- **Android** — APK или Google Play
- **iOS** — App Store
- **Windows** — \`.exe\` инсталлятор
- **macOS** — \`.dmg\`
- **Linux** — AppImage или \`.deb\`

## Импорт подписки

1. В личном кабинете proxels.ru скопируйте подписочную ссылку
   (кнопка «Копировать»).
2. Откройте Hiddify → нажмите **«Добавить из URL»** (значок «+» в правом верхнем углу).
3. Вставьте URL → **OK**.

Подписка появится в списке. Hiddify сам автоматически выберет лучший сервер
из доступных.

## Подключение

1. На главной странице переключите тумблер **«Подключиться»** в положение On.
2. На Android/iOS появится запрос разрешения VPN — подтвердите.
3. При успехе индикатор станет зелёным.

## Авто-обновление подписки

Hiddify умеет периодически перетягивать подписочный URL и подхватывать новые
ноды (failover): **Настройки → Подписки → Интервал обновления**. Рекомендуем
24 часа.

## Проблемы

**«No working server found»** — обновите подписку вручную (свайп вниз).
Возможно, все доступные сервера временно недоступны — мы автоматически
исключаем их из выдачи.

**Большая задержка** — попробуйте сменить сервер вручную: меню профиля →
выбрать другой из списка.
`;

const V2RAYTUN_MD = `## Установка

V2RayTun — компактный клиент для iOS/macOS/Android.

- **iOS** — [App Store](https://apps.apple.com/app/id6476628951)
- **macOS** — App Store или [GitHub](https://github.com/v2rayboss/V2RayTun)
- **Android** — Google Play или GitHub

## Импорт подписки

### iOS/macOS

1. Скопируйте подписочную ссылку из личного кабинета proxels.ru.
2. Откройте V2RayTun → правый верхний угол **«+»** → **«Добавить URL»**.
3. Вставьте подписку → **OK**.

### Android

То же самое: **«+»** в правом верхнем углу → **«Импорт из буфера»**.

## Подключение

1. Выберите профиль из списка.
2. Нажмите большую круглую кнопку **«Connect»**.
3. На iOS появится запрос разрешения VPN — подтвердите (один раз).

## Виджет на iOS

V2RayTun поддерживает виджет на главном экране — добавьте его через
**Edit Home Screen → +** для быстрого Connect/Disconnect.

## Проблемы

**«Subscription update failed»** — проверьте, что ваша подписка активна
в личном кабинете proxels.ru.

**На iOS не подключается** — убедитесь, что включён «Доступ к локальной сети»
для V2RayTun в **Настройках → V2RayTun**.
`;

const GUIDES: GuideSeed[] = [
  {
    slug: 'nekobox',
    title: 'Nekobox (Android)',
    platforms: 'Android',
    contentMd: NEKOBOX_MD,
    sortOrder: 0,
  },
  {
    slug: 'hiddify',
    title: 'Hiddify (все платформы)',
    platforms: 'Android · iOS · Windows · macOS · Linux',
    contentMd: HIDDIFY_MD,
    sortOrder: 1,
  },
  {
    slug: 'v2raytun',
    title: 'V2RayTun (iOS / macOS / Android)',
    platforms: 'iOS · macOS · Android',
    contentMd: V2RAYTUN_MD,
    sortOrder: 2,
  },
];

export async function seedGuides(prisma: PrismaClient): Promise<void> {
  for (const g of GUIDES) {
    const existing = await prisma.guide.findUnique({ where: { slug: g.slug } });
    if (existing) {
      await prisma.guide.update({
        where: { id: existing.id },
        data: {
          title: g.title,
          platforms: g.platforms,
          contentMd: g.contentMd,
          sortOrder: g.sortOrder,
          isPublished: true,
        },
      });
      console.log(`  ↻ guide "${g.slug}" updated`);
    } else {
      await prisma.guide.create({ data: { ...g, isPublished: true } });
      console.log(`  ✓ guide "${g.slug}" created`);
    }
  }
}
