import vCard from 'vcards-js';

const setContact = (contactDetails: any) => {
    try {
      const contactName = contactDetails[1];
      const phoneNumber = contactDetails[2].replace(/\s/g, '');;
      const Card = vCard();
      Card.firstName = contactName;
      Card.workPhone = phoneNumber;
      Card.title = 'Contact';
      const conatctfilePath = `./source/Contact/${contactName}.vcf`;
      Card.saveToFile(conatctfilePath);
      return `Contact saved with name ${contactName}`;
    } catch (err) {
      console.log("Error:" + err);
      return "There was an error while saving the contact"
    }
  
  }

  export default setContact;