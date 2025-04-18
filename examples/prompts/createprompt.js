import 'dotenv/config';
import { createPromptTemplate} from 'galileo';

const template = await createPromptTemplate({
    template: "Hi Andrii!",
    projectName: 'my-test-project-5',
    name: `Hello name prompt`
});
console.log(template);
