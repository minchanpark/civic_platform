import { CityInfo, RegionGroup } from '../types';

export interface RegionSection {
  groupKey: RegionGroup;
  titleZh: string;
  titleEn: string;
  iconName: string;
  cities: CityInfo[];
}

export const TAIWAN_REGIONS: RegionSection[] = [
  {
    groupKey: 'Northern',
    titleZh: '北部地區',
    titleEn: 'Northern',
    iconName: 'explore',
    cities: [
      { id: 'keelung', nameZh: '基隆市', nameEn: 'Keelung', region: 'Northern', lat: 25.1283, lng: 121.7419, zoom: 13, reportCount: 42 },
      { id: 'taipei', nameZh: '臺北市', nameEn: 'Taipei', region: 'Northern', lat: 25.0330, lng: 121.5654, zoom: 12, reportCount: 388 },
      { id: 'new_taipei', nameZh: '新北市', nameEn: 'New Taipei', region: 'Northern', lat: 25.0118, lng: 121.4658, zoom: 11, reportCount: 295 },
      { id: 'taoyuan', nameZh: '桃園市', nameEn: 'Taoyuan', region: 'Northern', lat: 24.9936, lng: 121.3010, zoom: 12, reportCount: 156 },
      { id: 'hsinchu_city', nameZh: '新竹市', nameEn: 'Hsinchu City', region: 'Northern', lat: 24.8138, lng: 120.9675, zoom: 13, reportCount: 82 },
      { id: 'hsinchu_county', nameZh: '新竹縣', nameEn: 'Hsinchu County', region: 'Northern', lat: 24.8382, lng: 121.0082, zoom: 11, reportCount: 45 },
    ],
  },
  {
    groupKey: 'Central',
    titleZh: '中部地區',
    titleEn: 'Central',
    iconName: 'location_on',
    cities: [
      { id: 'miaoli', nameZh: '苗栗縣', nameEn: 'Miaoli', region: 'Central', lat: 24.5602, lng: 120.8214, zoom: 11, reportCount: 64 },
      { id: 'taichung', nameZh: '臺中市', nameEn: 'Taichung', region: 'Central', lat: 24.1477, lng: 120.6736, zoom: 12, reportCount: 210 },
      { id: 'changhua', nameZh: '彰化縣', nameEn: 'Changhua', region: 'Central', lat: 24.0817, lng: 120.5385, zoom: 12, reportCount: 98 },
      { id: 'nantou', nameZh: '南投縣', nameEn: 'Nantou', region: 'Central', lat: 23.9037, lng: 120.6859, zoom: 11, reportCount: 75 },
    ],
  },
  {
    groupKey: 'Southern',
    titleZh: '南部地區',
    titleEn: 'Southern',
    iconName: 'wb_sunny',
    cities: [
      { id: 'yunlin', nameZh: '雲林縣', nameEn: 'Yunlin', region: 'Southern', lat: 23.7092, lng: 120.4313, zoom: 11, reportCount: 52 },
      { id: 'chiayi_city', nameZh: '嘉義市', nameEn: 'Chiayi City', region: 'Southern', lat: 23.4801, lng: 120.4491, zoom: 13, reportCount: 41 },
      { id: 'chiayi_county', nameZh: '嘉義縣', nameEn: 'Chiayi County', region: 'Southern', lat: 23.4580, lng: 120.3320, zoom: 11, reportCount: 28 },
      { id: 'tainan', nameZh: '臺南市', nameEn: 'Tainan', region: 'Southern', lat: 22.9997, lng: 120.2270, zoom: 12, reportCount: 184 },
      { id: 'kaohsiung', nameZh: '高雄市', nameEn: 'Kaohsiung', region: 'Southern', lat: 22.6273, lng: 120.3014, zoom: 12, reportCount: 245 },
      { id: 'pingtung', nameZh: '屏東縣', nameEn: 'Pingtung', region: 'Southern', lat: 22.6713, lng: 120.4880, zoom: 11, reportCount: 88 },
    ],
  },
  {
    groupKey: 'Eastern',
    titleZh: '東部地區',
    titleEn: 'Eastern',
    iconName: 'terrain',
    cities: [
      { id: 'yilan', nameZh: '宜蘭縣', nameEn: 'Yilan', region: 'Eastern', lat: 24.7570, lng: 121.7530, zoom: 11, reportCount: 61 },
      { id: 'hualien', nameZh: '花蓮縣', nameEn: 'Hualien', region: 'Eastern', lat: 23.9871, lng: 121.6015, zoom: 10, reportCount: 112 },
      { id: 'taitung', nameZh: '臺東縣', nameEn: 'Taitung', region: 'Eastern', lat: 22.7613, lng: 121.1444, zoom: 10, reportCount: 47 },
    ],
  },
  {
    groupKey: 'Offshore',
    titleZh: '外島地區',
    titleEn: 'Offshore Islands',
    iconName: 'sailing',
    cities: [
      { id: 'lienchiang', nameZh: '連江縣', nameEn: 'Lienchiang', region: 'Offshore', lat: 26.1505, lng: 119.9499, zoom: 12, reportCount: 15 },
      { id: 'kinmen', nameZh: '金門縣', nameEn: 'Kinmen', region: 'Offshore', lat: 24.4493, lng: 118.3766, zoom: 12, reportCount: 28 },
      { id: 'penghu', nameZh: '澎湖縣', nameEn: 'Penghu', region: 'Offshore', lat: 23.5711, lng: 119.5793, zoom: 12, reportCount: 33 },
    ],
  },
];
