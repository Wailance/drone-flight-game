(function () {
  const WIDTH = 1600;
  const HEIGHT = 1100;
  const NAVY = '#102847';
  const BLUE = '#205cf5';
  const INK = '#182b46';
  const MUTED = '#60718b';

  function roundRect(ctx, x, y, width, height, radius, fill) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function label(ctx, text, x, y, font, color, align = 'left') {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }

  function downloadCertificate({ level, amount, total, final = false, awardedAt, certificateId }) {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const missions = {
      1: ['01', 'Обследование объекта', 'Лидарное сканирование здания'],
      2: ['02', 'Агродрон', 'Обработка поля с воздуха'],
      3: ['03', 'FPV-съёмка', 'Съёмка гоночной трассы'],
    };
    const mission = missions[level] || missions[1];
    const date = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' }).format(
      awardedAt && !Number.isNaN(Date.parse(awardedAt)) ? new Date(awardedAt) : new Date(),
    );
    const number = certificateId || (final ? 'AERO-FINAL-PREVIEW' : `AERO-0${level}-PREVIEW`);
    const money = value => `${Number(value).toLocaleString('ru-RU')} ₽`;

    ctx.fillStyle = '#dbe7fb';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const paper = ctx.createLinearGradient(74, 72, 1490, 1020);
    paper.addColorStop(0, '#ffffff');
    paper.addColorStop(.68, '#fafcff');
    paper.addColorStop(1, '#e9f1ff');
    ctx.shadowColor = 'rgba(15, 41, 78, .20)';
    ctx.shadowBlur = 38;
    ctx.shadowOffsetY = 15;
    roundRect(ctx, 52, 48, 1496, 1004, 16, paper);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(52, 48, 1496, 1004, 16);
    ctx.clip();
    const header = ctx.createLinearGradient(52, 48, 1548, 350);
    header.addColorStop(0, '#0c2442');
    header.addColorStop(.57, '#143b6c');
    header.addColorStop(1, '#2367df');
    ctx.fillStyle = header;
    ctx.fillRect(52, 48, 1496, 310);
    ctx.strokeStyle = 'rgba(160, 207, 255, .18)';
    ctx.lineWidth = 2;
    for (let index = 0; index < 7; index++) {
      ctx.beginPath();
      ctx.ellipse(1370, 153, 235 + index * 54, 83 + index * 42, -.33, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#78c8ff';
    ctx.fillRect(52, 346, 1496, 12);
    ctx.restore();

    roundRect(ctx, 118, 99, 62, 62, 13, '#72c8ff');
    label(ctx, 'А', 149, 145, 'bold 46px Arial, sans-serif', NAVY, 'center');
    label(ctx, 'АЭРОГЕНИИ', 202, 128, 'bold 42px Arial, sans-serif', '#ffffff');
    label(ctx, 'ШКОЛА БЕСПИЛОТНЫХ СИСТЕМ', 203, 160, 'bold 17px Arial, sans-serif', '#b9dbff');
    label(ctx, 'ПРАКТИКА ОПЕРАТОРА БПЛА', 120, 274, 'bold 19px Arial, sans-serif', '#9bc9ff');
    label(ctx, final ? 'ВСЕ МИССИИ ПРОЙДЕНЫ' : `МИССИЯ ${mission[0]} / 03`, 1480, 125,
      'bold 20px Arial, sans-serif', '#d8efff', 'right');
    label(ctx, 'ИГРА • ОБУЧЕНИЕ • ВОЗМОЖНОСТИ', 1480, 158,
      '16px Arial, sans-serif', '#b9dbff', 'right');

    label(ctx, final ? 'ИТОГОВЫЙ КУПОН' : 'СЕРТИФИКАТ', 120, 470,
      'bold 66px Arial, sans-serif', INK);
    ctx.fillStyle = BLUE;
    ctx.fillRect(120, 496, 84, 6);
    label(ctx, final ? 'Три миссии. Три навыка. Один шаг к профессии.'
      : 'За прохождение практической миссии', 120, 549,
    '24px Arial, sans-serif', MUTED);

    label(ctx, final ? 'Ваш путь в мире дронов' : mission[1], 120, 641,
      'bold 35px Arial, sans-serif', INK);
    label(ctx, final ? 'Обследование • агродрон • FPV' : mission[2], 120, 685,
      '23px Arial, sans-serif', MUTED);

    const card = ctx.createLinearGradient(960, 403, 1480, 790);
    card.addColorStop(0, '#1744a8');
    card.addColorStop(1, '#287bff');
    roundRect(ctx, 960, 405, 520, 363, 18, card);
    ctx.strokeStyle = 'rgba(255, 255, 255, .27)';
    ctx.lineWidth = 2;
    ctx.strokeRect(980, 425, 480, 323);
    label(ctx, 'ВАША СКИДКА НА ОБУЧЕНИЕ', 1003, 472,
      'bold 17px Arial, sans-serif', '#d5e9ff');
    label(ctx, money(amount), 1003, 590, 'bold 88px Arial, sans-serif', '#ffffff');
    ctx.fillStyle = 'rgba(255, 255, 255, .34)';
    ctx.fillRect(1003, 630, 428, 1);
    label(ctx, 'НАКОПЛЕНО ЗА ИГРУ', 1003, 673,
      'bold 15px Arial, sans-serif', '#d5e9ff');
    label(ctx, `${money(total)} из 10 000 ₽`, 1003, 719,
      'bold 30px Arial, sans-serif', '#ffffff');

    ctx.fillStyle = '#dce7f6';
    ctx.fillRect(120, 806, 1360, 1);
    label(ctx, 'КУДА ПРИМЕНИТЬ', 120, 857,
      'bold 16px Arial, sans-serif', BLUE);
    label(ctx, 'Курс «Инструкторский» или «Специалист»', 120, 897,
      'bold 24px Arial, sans-serif', INK);
    label(ctx, 'Для использования подпишитесь на группу школы во ВКонтакте', 120, 940,
      '19px Arial, sans-serif', MUTED);
    label(ctx, 'и покажите этот сертификат менеджеру.', 120, 970,
      '19px Arial, sans-serif', MUTED);

    label(ctx, 'vk.com/aerogenii_kirov', 1480, 859,
      'bold 20px Arial, sans-serif', BLUE, 'right');
    label(ctx, '+7 (8332) 25-03-09', 1480, 895,
      'bold 19px Arial, sans-serif', INK, 'right');
    label(ctx, 'Киров, ул. Широтная, д. 2', 1480, 927,
      '17px Arial, sans-serif', MUTED, 'right');
    label(ctx, `Выдан ${date}`, 1480, 975,
      '16px Arial, sans-serif', MUTED, 'right');

    ctx.fillStyle = NAVY;
    ctx.fillRect(52, 1013, 1496, 39);
    label(ctx, `№ ${number}`, 120, 1039, 'bold 15px Arial, sans-serif', '#e5f1ff');
    label(ctx, 'АЭРОГЕНИИ • ОБУЧЕНИЕ УПРАВЛЕНИЮ БПЛА', 1480, 1039,
      'bold 14px Arial, sans-serif', '#e5f1ff', 'right');

    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `aerogenii-${final ? 'kupon-final' : `sertifikat-uroven-${level}`}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }, 'image/png');
  }

  window.downloadPreviewCertificate = downloadCertificate;
})();
