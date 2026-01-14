import React from 'react';
import { Checkbox, Card, Space } from 'antd';
import { Bot } from '../services/api';

interface BotFilterProps {
  bots: Bot[];
  selectedBots: string[];
  onBotToggle: (botId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

const BotFilter: React.FC<BotFilterProps> = ({
  bots,
  selectedBots,
  onBotToggle,
  onSelectAll,
  onDeselectAll
}) => {
  const allSelected = selectedBots.length === bots.length;
  const someSelected = selectedBots.length > 0 && selectedBots.length < bots.length;

  return (
    <Card title="BOT 필터" style={{ marginBottom: '20px' }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Checkbox
          indeterminate={someSelected}
          checked={allSelected}
          onChange={(e) => {
            if (e.target.checked) {
              onSelectAll();
            } else {
              onDeselectAll();
            }
          }}
        >
          전체 선택
        </Checkbox>
        {bots.map(bot => (
          <Checkbox
            key={bot.id}
            checked={selectedBots.includes(bot.id)}
            onChange={() => onBotToggle(bot.id)}
            style={{ display: 'block' }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                backgroundColor: bot.color,
                borderRadius: '2px',
                marginRight: '8px'
              }}
            />
            {bot.name}
          </Checkbox>
        ))}
      </Space>
    </Card>
  );
};

export default BotFilter;


