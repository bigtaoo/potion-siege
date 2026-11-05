// The three later potions' words; key for key with potions/en.ts.
import type { potions as en } from './en';

export const potions: typeof en = {
  hero: { light: 'Bình Ánh Sáng', metal: 'Bình Thủy Ngân', vine: 'Bình Gai' },
  role: { light: 'Tia xuyên thấu', metal: 'Đòn nặng', vine: 'Trói chân' },
  rx: { prism: 'Lăng kính', flare: 'Lóa sáng', magnetize: 'Từ hóa', molten: 'Nóng chảy', spores: 'Bào tử', bramble: 'Gai băng' },
  rxDo: {
    prism: 'Băng giá tách ánh sáng: tia vào 3 địch gần nhất',
    flare: 'Bùng nổ nhiệt và ánh sáng: sát thương và làm chậm xung quanh',
    magnetize: 'Thủy ngân hóa nam châm: hút mọi thứ xung quanh',
    molten: 'Thủy ngân sôi trào: thiêu đốt dữ dội',
    spores: 'Dây leo nở hoa độc lên mọi thứ xung quanh',
    bramble: 'Gai băng bật ra: trói chân mọi thứ xung quanh',
  },
  skill: {
    lightDamage: { name: 'Rực Rỡ', desc: 'Bình Ánh Sáng +40% sát thương' },
    lightWide: { name: 'Tia Rộng', desc: 'Tia sáng rộng hơn 40%' },
    lightGlare: { name: 'Chói Lóa', desc: 'Tia làm chậm 20% mọi thứ nó quét qua trong 1s' },
    lightFocus: { name: 'Hội Tụ', desc: 'Tia đánh mọi thứ trên đường mạnh như mục tiêu' },
    lightFire: { name: 'Lửa Mặt Trời', desc: 'Tia thiêu đốt như lửa' },
    metalDamage: { name: 'Kim Loại Nặng', desc: 'Bình Thủy Ngân +40% sát thương' },
    metalShrapnel: { name: 'Mảnh Vụn', desc: 'Đạn bắn tóe 30% đòn đánh ra xung quanh' },
    metalCrush: { name: 'Quật Ngã', desc: 'Đạn có thể quật ngã 0,6s (15%); Boss bị chậm' },
    metalBreak: { name: 'Phá Giáp', desc: 'Đạn làm địch giòn 1,5s: +40% sát thương nhận vào' },
    metalFire: { name: 'Lò Rèn', desc: 'Đạn +60% sát thương lên địch đang cháy' },
    vineDamage: { name: 'Um Tùm', desc: 'Bình Gai +40% sát thương' },
    vineRoot: { name: 'Rễ Sâu', desc: 'Trói chân lâu hơn 30%' },
    vineThorns: { name: 'Gai Nhọn', desc: 'Địch bị trói chân mất máu 40% đòn đánh mỗi giây' },
    vineSpread: { name: 'Dây Leo', desc: 'Hạ địch bằng dây leo sẽ trói chân địch gần nhất' },
    vinePoison: { name: 'Gai Độc', desc: 'Đòn dây leo gây độc như Bình Ăn Mòn' },
  },
  perk: {
    lightGlarePlus: 'Chói Lóa làm chậm mạnh hơn 50%',
    metalCrushPlus: 'Quật ngã lâu hơn 50%',
    vineThornsPlus: 'Gai Nhọn +50% sát thương',
  },
};
