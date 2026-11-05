// The long-term features' words (ref/design/long-term-plan.md): reactions found and mastered,
// the lab, the brewing rack, talents, the tower, rebrew, the weekly mutator. Their own file, as
// the language's table is near the length limit; key for key with alchemy/en.ts.

import type { Table } from '../en';

export const alchemy: Table['alchemy'] = {
  found: 'Phản ứng mới: {name}! +{n} pha lê',
  starred: 'Thành thạo {name} {s}★: sức mạnh +{p}%',
  power: 'Sức mạnh +{p}%',
  legendBoost: 'Cường hóa {name}',
  exits: {
    title: 'Lối đi khác',
    lineup: 'Thử đội hình này',
    reacts: '{n} phản ứng với nhau',
    hard: 'Chế độ khó, chương {c}',
    hardDesc: 'Thưởng như màn xa hơn',
    tower: 'Tháp giả kim',
    towerDesc: 'Leo tầng lấy pha lê',
  },
  rack: {
    name: 'Giá ủ thuốc',
    claim: '+{n}',
    got: 'Giá ủ: +{n} pha lê',
    full: 'Đầy',
  },
  replayCut: 'Chơi lại hôm nay: nửa pha lê',
  talents: {
    open: 'Thiên phú',
    title: '{name}: thiên phú',
    both: 'Cả hai thiên phú Lv {n}',
    free: 'Mỗi trận bắt đầu với các thẻ này. Đổi miễn phí bất cứ lúc nào.',
  },
  catalyst: {
    title: 'Chất xúc tác: chọn một',
    held: 'Đã có ×{n}',
    volatile: {
      name: 'Muối dễ bay hơi',
      desc: 'Phản ứng gây thêm 50% sát thương đến hết lượt leo.',
    },
    wide: {
      name: 'Hơi lan tỏa',
      desc: 'Phản ứng lan rộng hơn 30% đến hết lượt leo.',
    },
    potent: {
      name: 'Tinh chất',
      desc: 'Mọi bình thuốc gây thêm 20% sát thương.',
    },
    quick: {
      name: 'Thủy ngân',
      desc: 'Mọi bình thuốc tấn công nhanh hơn 15%.',
    },
    bulwark: {
      name: 'Vữa đá',
      desc: 'Tường tăng 40% máu tối đa và được sửa đầy.',
    },
    bounty: {
      name: 'Lá vàng',
      desc: 'Mỗi lần hạ địch được thêm 2 vàng.',
    },
  },
  rebrew: {
    button: 'Ủ lại',
    count: 'Số lần ủ lại: {n}',
    essence: 'Tinh chất: {n}',
    what: 'Đổ tất cả lại vào vạc: chiến dịch bắt đầu lại từ màn 1, bình thuốc về cấp đầu. Bạn giữ sổ tay, độ thành thạo phản ứng, thiên phú, sao, pha lê và một nửa phòng thí nghiệm, và nhận tinh chất để mua lợi ích vĩnh viễn.',
    go: 'Ủ lại: +{n} tinh chất',
    sure: 'Chạm lần nữa để xác nhận',
    locked: 'Qua màn {n} để ủ lại',
    done: 'Đã ủ lại! +{n} tinh chất',
    perks: 'Lợi ích vĩnh viễn',
    perk: {
      reaction: 'Phản ứng +{p}%',
      wall: 'Máu tường +{p}%',
      gold: 'Vàng khởi đầu +{n}',
      crystals: 'Pha lê +{p}%',
    },
  },
  week: {
    button: 'Tuần',
    title: 'Tuần này',
    rule: 'Luật tháp: {name}',
    left: 'Tuần mới sau: {n} ngày',
    best: 'Tầng cao nhất tuần: {n}',
    play: 'Leo tháp',
    surge: {
      name: 'Cuồng triều',
      desc: 'Phản ứng gây 2× sát thương; địch tăng 30% máu.',
    },
    focus: {
      name: 'Tập trung',
      desc: '{name} gây 4× sát thương.',
    },
    glass: {
      name: 'Pháo thủy tinh',
      desc: 'Phản ứng gây 2,5× sát thương; bình thuốc giảm 20%.',
    },
    brittle: {
      name: 'Tường giòn',
      desc: 'Phản ứng gây 1,8× sát thương; tường giảm 25% máu.',
    },
    task: {
      kinds: 'Kích hoạt {n} loại phản ứng khác nhau',
      react: 'Kích hoạt {n} phản ứng',
      tower: 'Lên tầng {n} của tháp',
      challenge: 'Chơi {n} thử thách hằng ngày',
    },
  },
  next: {
    find: 'Còn {n} phản ứng chưa tìm ra: thử cặp mới nhé!',
    week: 'Có nhiệm vụ tuần để nhận',
    tower: 'Tháp tuần này: {name}. Tầng cao nhất {n}',
    rebrew: 'Đã xong chiến dịch: ủ lại nhận {n} tinh chất',
    perk: 'Tinh chất có thể dùng: {n}',
  },
};
