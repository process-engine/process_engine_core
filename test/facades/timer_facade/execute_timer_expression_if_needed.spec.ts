import * as should from 'should';

import {TimerFacade} from '../../../src/runtime/facades/timer_facade';
import {TestFixtureProvider} from '../../test_fixture_provider';

describe('TimerFacade.executeTimerExpressionIfNeeded', (): void => {

  let fixtureProvider: TestFixtureProvider;
  let timerFacade: TimerFacade;

  const processTokenFacadeMock = {
    getOldTokenFormat: (): any => {
      return {
        current: 'hello',
        history: {
          FlowNode1: 'hello',
          FlowNode2: {
            someValue: 'world',
          },
        },
      };
    },
  };

  before(async (): Promise<void> => {
    fixtureProvider = new TestFixtureProvider();
    await fixtureProvider.initialize();

    timerFacade = await fixtureProvider.createTimerFacade();
  });

  describe('Execution', (): void => {

    it('Should return the expected result, if no token expression is used.', (): void => {

      const timerExpression = 'some sample';
      const result = timerFacade.executeTimerExpressionIfNeeded(timerExpression, processTokenFacadeMock as any);

      should(result).be.equal(timerExpression);
    });

    it('Should return the expected result, if a valid token expression with "token.current" is used.', (): void => {

      const timerExpression = 'token.current + \' world\'';
      const result = timerFacade.executeTimerExpressionIfNeeded(timerExpression, processTokenFacadeMock as any);

      should(result).be.equal('hello world');
    });

    it('Should return the expected result, if a valid token expression with "token.history" is used.', (): void => {

      const timerExpression = 'token.history.FlowNode1 + \' world\'';
      const result = timerFacade.executeTimerExpressionIfNeeded(timerExpression, processTokenFacadeMock as any);

      should(result).be.equal('hello world');
    });

    it('Should return the expected result, when accessing a partial result subset of a FlowNode.', (): void => {

      const timerExpression = 'token.history.FlowNode2.someValue + \' world\'';
      const result = timerFacade.executeTimerExpressionIfNeeded(timerExpression, processTokenFacadeMock as any);

      should(result).be.equal('world world');
    });

    it('Should return the expected result, if multiple token expressions are used.', (): void => {

      const timerExpression = 'token.current + \' \' + token.history.FlowNode1';
      const result = timerFacade.executeTimerExpressionIfNeeded(timerExpression, processTokenFacadeMock as any);

      should(result).be.equal('hello hello');
    });
  });

  describe('Sanity Checks', (): void => {

    it('Should not throw an error, if the timer expression is undefined.', (): void => {

      const result = timerFacade.executeTimerExpressionIfNeeded(undefined, processTokenFacadeMock as any);

      should.not.exist(result);
    });

    it('Should throw an error, if no ProcessTokenFacade is provided.', (): void => {
      try {
        const result = timerFacade.executeTimerExpressionIfNeeded('some sample', processTokenFacadeMock as any);
        should.fail(result, undefined, 'This should have failed, because of a missing ProcessTokenFacade!');
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should throw an error, if the token expression is not contained in the actual ProcessToken.', (): void => {
      try {
        const result = timerFacade.executeTimerExpressionIfNeeded('token.i.am.wrong', processTokenFacadeMock as any);
        should.fail(result, undefined, 'This should have failed, because of an invalid token expression!');
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });

    it('Should throw an error, if the token expression contains invalid code.', (): void => {
      try {
        const result = timerFacade.executeTimerExpressionIfNeeded('token.;', processTokenFacadeMock as any);
        should.fail(result, undefined, 'This should have failed, because of a malformed expression!');
      } catch (error) {
        should(error).be.instanceOf(Error);
      }
    });
  });
});
