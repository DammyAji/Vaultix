import { validate } from 'class-validator';
import {
  CreateEscrowDto,
  EscrowAssetDto,
  CreatePartyDto,
  CreateConditionDto,
} from './create-escrow.dto';
import { EscrowType } from '../entities/escrow.entity';
import { PartyRole } from '../entities/party.entity';
import { ConditionType } from '../entities/condition.entity';

describe('CreateEscrowDto', () => {
  describe('EscrowAssetDto', () => {
    it('should validate XLM without issuer', async () => {
      const dto = new EscrowAssetDto();
      dto.code = 'XLM';
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate custom asset with issuer', async () => {
      const dto = new EscrowAssetDto();
      dto.code = 'USD';
      dto.issuer = 'GD5JDQXKEVPR7QD2R7LXKXN7M4ZGAPYI7F7DQ7K7D7D7D7D7D7D7D';
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject custom asset without issuer', async () => {
      const dto = new EscrowAssetDto();
      dto.code = 'USD';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid issuer', async () => {
      const dto = new EscrowAssetDto();
      dto.code = 'USD';
      dto.issuer = 'invalid';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject code exceeding max length', async () => {
      const dto = new EscrowAssetDto();
      dto.code = 'A'.repeat(13);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('CreatePartyDto', () => {
    it('should validate with valid UUID and role', async () => {
      const dto = new CreatePartyDto();
      dto.userId = '123e4567-e89b-12d3-a456-426614174000';
      dto.role = PartyRole.BUYER;
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid UUID', async () => {
      const dto = new CreatePartyDto();
      dto.userId = 'invalid-uuid';
      dto.role = PartyRole.BUYER;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject missing userId', async () => {
      const dto = new CreatePartyDto();
      dto.role = PartyRole.BUYER;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('CreateConditionDto', () => {
    it('should validate with description', async () => {
      const dto = new CreateConditionDto();
      dto.description = 'Payment must be received';
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with optional type', async () => {
      const dto = new CreateConditionDto();
      dto.description = 'Payment must be received';
      dto.type = ConditionType.MANUAL;
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject empty description', async () => {
      const dto = new CreateConditionDto();
      dto.description = '';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject description exceeding max length', async () => {
      const dto = new CreateConditionDto();
      dto.description = 'A'.repeat(1001);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('CreateEscrowDto', () => {
    it('should validate with minimal required fields', async () => {
      const dto = new CreateEscrowDto();
      dto.title = 'Test Escrow';
      dto.amount = 100;
      dto.parties = [
        {
          userId: '123e4567-e89b-12d3-a456-426614174000',
          role: PartyRole.BUYER,
        },
      ];
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with all fields', async () => {
      const dto = new CreateEscrowDto();
      dto.title = 'Test Escrow';
      dto.description = 'Test description';
      dto.amount = 100;
      dto.asset = { code: 'XLM' };
      dto.type = EscrowType.MILESTONE;
      dto.parties = [
        {
          userId: '123e4567-e89b-12d3-a456-426614174000',
          role: PartyRole.BUYER,
        },
      ];
      dto.conditions = [
        {
          description: 'Condition 1',
          type: ConditionType.MANUAL,
        },
      ];
      dto.expiresAt = '2026-12-31T23:59:59.999Z';
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject missing title', async () => {
      const dto = new CreateEscrowDto();
      dto.amount = 100;
      dto.parties = [
        {
          userId: '123e4567-e89b-12d3-a456-426614174000',
          role: PartyRole.BUYER,
        },
      ];
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject negative amount', async () => {
      const dto = new CreateEscrowDto();
      dto.title = 'Test';
      dto.amount = -100;
      dto.parties = [
        {
          userId: '123e4567-e89b-12d3-a456-426614174000',
          role: PartyRole.BUYER,
        },
      ];
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject empty parties array', async () => {
      const dto = new CreateEscrowDto();
      dto.title = 'Test';
      dto.amount = 100;
      dto.parties = [];
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject title exceeding max length', async () => {
      const dto = new CreateEscrowDto();
      dto.title = 'A'.repeat(256);
      dto.amount = 100;
      dto.parties = [
        {
          userId: '123e4567-e89b-12d3-a456-426614174000',
          role: PartyRole.BUYER,
        },
      ];
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
