@manual @fees
Feature: Fees accounts payments and balances
  Start with local:reset and the fictional accounts in docs/testing/new-laptop.md.
  Prepare each scenario independently using the Given condition.

  @TC_FEES_001 @P0
  Scenario: Charges and statement
    Given administrator A configures a fictional fee structure and learner account
    When charges are generated for the selected period
    Then the balance equals the charges and parent A sees the matching statement

  @TC_FEES_002 @P0
  Scenario: Confirm payment exactly once
    Given Learner A owes 1000 rand in fictional charges
    When an administrator records and confirms 400 rand then repeats confirmation
    Then the confirmed balance is 600 rand and no second deduction occurs

  @TC_FEES_003 @P1
  Scenario: Unconfirmed payment
    Given a payment is recorded but not confirmed
    When administrator and parent inspect the account
    Then the payment state is clear and the balance follows the confirmed-payment rule

  @TC_FEES_004 @P1
  Scenario: Invalid payment amount
    Given an administrator opens Record payment
    When they enter zero, a negative amount or missing required details
    Then validation rejects the payment and the balance is unchanged

  @TC_FEES_005 @P1
  Scenario: Arrears export
    Given two learners have different unpaid balances
    When administrator A exports arrears for the selected period
    Then the export contains the correct learners and balances only for School A

  @TC_FEES_006 @P1
  Scenario: Fees permissions
    Given Teacher A and parent B sign in separately
    When they request Learner A private fee account or confirm a payment
    Then the operation is denied and the account remains unchanged
