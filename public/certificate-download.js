(function () {
  function downloadCertificate({ level, amount, total, final = false, awardedAt, certificateId }) {
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1100;
    const context = canvas.getContext('2d');
    if (!context) return;
    const logo = new Image();
    const levelName = final
      ? 'НАКОПЛЕННАЯ НАГРАДА'
      : level === 1
        ? 'ОБСЛЕДОВАНИЕ ОБЪЕКТА'
        : level === 2
          ? 'РАБОТА С АГРОДРОНОМ'
          : 'FPV-СЪЁМКА';
    const title = final ? 'КУПОН НА ОБУЧЕНИЕ' : 'СЕРТИФИКАТ';
    const date = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' }).format(
      awardedAt ? new Date(awardedAt) : new Date(),
    );
    const number = certificateId || (final ? 'AERO-FINAL-PREVIEW' : `AERO-0${level}-PREVIEW`);
    const render = () => {
      const navy = '#172f4d';
      const blue = '#1f5bff';
      const ink = '#27364b';
      const muted = '#6d7b8e';
      const paper = context.createLinearGradient(0, 0, 1600, 1100);
      paper.addColorStop(0, '#ffffff');
      paper.addColorStop(.55, '#f8fbff');
      paper.addColorStop(1, '#e8f1ff');

      context.fillStyle = '#e8f0fb';
      context.fillRect(0, 0, 1600, 1100);
      context.fillStyle = paper;
      context.fillRect(48, 48, 1504, 1004);
      context.strokeStyle = navy;
      context.lineWidth = 5;
      context.strokeRect(48, 48, 1504, 1004);
      context.strokeStyle = '#9bbcff';
      context.lineWidth = 2;
      context.strokeRect(68, 68, 1464, 964);
      context.fillStyle = navy;
      context.fillRect(48, 48, 1504, 18);
      context.fillRect(48, 1034, 1504, 18);

      context.save();
      context.globalAlpha = .06;
      context.strokeStyle = blue;
      context.lineWidth = 12;
      for (let index = -2; index < 8; index++) {
        context.beginPath();
        context.moveTo(920 + index * 180, 80);
        context.lineTo(1320 + index * 180, 1020);
        context.stroke();
      }
      context.restore();

      if (logo.complete && logo.naturalWidth) context.drawImage(logo, 112, 102, 130, 130);
      context.textAlign = 'left';
      context.fillStyle = navy;
      context.font = '700 30px Arial';
      context.fillText('АЭРОГЕНИИ', 270, 140);
      context.fillStyle = blue;
      context.font = '600 16px Arial';
      context.fillText('ШКОЛА БЕСПИЛОТНЫХ СИСТЕМ', 270, 171);
      context.fillStyle = muted;
      context.font = '15px Arial';
      context.fillText('Практический симулятор профессии оператора БПЛА', 270, 198);

      context.textAlign = 'center';
      context.fillStyle = blue;
      context.font = '800 16px Arial';
      context.fillText(final ? 'НАГРАДА ЗА ПРОЙДЕННЫЕ МИССИИ' : 'ПОДТВЕРЖДЕНИЕ РЕЗУЛЬТАТА', 800, 310);
      context.fillStyle = ink;
      context.font = '600 66px Georgia';
      context.fillText(title, 800, 397);
      context.fillStyle = muted;
      context.font = '23px Arial';
      context.fillText('за успешное прохождение практического уровня', 800, 443);
      context.fillStyle = navy;
      context.font = '700 25px Arial';
      context.fillText(final ? levelName : `УРОВЕНЬ 0${level}  /  ${levelName}`, 800, 518);
      context.fillStyle = blue;
      context.font = '800 92px Arial';
      context.fillText(`${Number(amount).toLocaleString('ru-RU')} ₽`, 800, 655);
      context.fillStyle = ink;
      context.font = '23px Arial';
      context.fillText('скидка на обучение по выбору', 800, 710);
      context.font = '700 29px Arial';
      context.fillText('«Инструкторский»  ·  «Специалист»', 800, 758);
      context.fillStyle = muted;
      context.font = '20px Arial';
      context.fillText(`Накоплено: ${Number(total).toLocaleString('ru-RU')} ₽ из 10 000 ₽`, 800, 815);

      context.textAlign = 'left';
      context.fillStyle = '#edf3ff';
      context.fillRect(110, 872, 1380, 82);
      context.fillStyle = ink;
      context.font = '700 17px Arial';
      context.fillText('УСЛОВИЕ АКТИВАЦИИ', 140, 907);
      context.fillStyle = muted;
      context.font = '16px Arial';
      context.fillText('Подпишитесь на группу школы «Аэрогении» во ВКонтакте и покажите сертификат менеджеру.', 140, 934);
      context.fillStyle = blue;
      context.font = '700 16px Arial';
      context.fillText('vk.com/aerogenii_kirov', 140, 978);
      context.fillStyle = muted;
      context.textAlign = 'right';
      context.font = '15px Arial';
      context.fillText(`Выдан ${date}`, 1460, 907);
      context.fillText(`№ ${number}`, 1460, 934);
      context.fillText('Киров · ул. Широтная, д. 2', 1460, 978);
    };
    const save = blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `aerogenii-${final ? 'kupon-final' : `sertifikat-uroven-${level}`}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    const finish = () => { render(); canvas.toBlob(save, 'image/png'); };
    logo.onload = finish;
    logo.onerror = finish;
    logo.src = new URL('logo.png', document.baseURI).href;
  }
  window.downloadPreviewCertificate = downloadCertificate;
})();
